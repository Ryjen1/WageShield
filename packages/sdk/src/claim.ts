/**
 * Claim-flow helpers: submission, decryption (worker / attorney / regulator).
 *
 * High-level surface:
 *   • `submitClaim`     — encrypt hours/rate, build the calldata, send the tx, parse
 *                         the `ClaimSubmitted` event and return a structured result.
 *   • `decryptOwed`     — fetch a claim's encrypted owed handle and decrypt it via
 *                         the active CoFHE permit (worker or granted attorney).
 *   • `decryptAggregate` — decrypt a per-employer aggregate (regulator only).
 *
 * Every helper takes the `WageShieldClient` (already connected) and a contract
 * `Address` so they're stateless and trivially testable.
 */
import { ethers } from "ethers";
import { Encryptable, FheTypes } from "@cofhe/sdk";
import { WAGECLAIM_ABI } from "./abi";
import type {
  Address,
  ClaimSubmittedEvent,
  Hex32,
  SignedAttestation,
  SubmitClaimResult,
} from "./types";
import type { WageShieldClient } from "./client";

/**
 * Submit a wage-theft claim against a deployed `WageClaim`. Encrypts the worker's
 * hours + rate via `@cofhe/sdk`, attaches the issuer attestation + signature,
 * sends the transaction, and parses the resulting `ClaimSubmitted` event.
 *
 * The encrypted plaintext values must equal the plaintext values committed to in
 * `signedAttestation.attestation` — mismatch is self-defeating but not detectable
 * on-chain (see honest-limits doc).
 */
export async function submitClaim(args: {
  client: WageShieldClient;
  signer: ethers.Signer;
  wageClaimAddress: Address;
  signedAttestation: SignedAttestation;
}): Promise<SubmitClaimResult> {
  const { client, signer, wageClaimAddress, signedAttestation } = args;
  const { attestation, signature } = signedAttestation;

  // Encrypt the plaintext hours + rate. The CoFHE coprocessor returns ZK-proven
  // `InEuint*` structs that the contract calls `FHE.asEuint*(...)` on to obtain
  // ciphertext handles.
  const [eHours, eRate] = await client
    .encryptInputs([
      Encryptable.uint64(attestation.hoursWorked),
      Encryptable.uint32(BigInt(attestation.hourlyRateCents)),
    ])
    .execute();

  const wageClaim = new ethers.Contract(wageClaimAddress, WAGECLAIM_ABI, signer);
  const tx = await wageClaim.submitClaim(
    attestation.employerId,
    attestation.hoursWorked,
    attestation.hourlyRateCents,
    attestation.periodStart,
    attestation.periodEnd,
    attestation.issuedAt,
    attestation.nonce,
    signature,
    eHours,
    eRate,
  );
  const receipt = await tx.wait();
  if (!receipt) throw new Error("submitClaim: tx receipt was null");

  const event = parseClaimSubmittedEvent(receipt, wageClaim.interface);
  if (!event) throw new Error("submitClaim: ClaimSubmitted event not found in receipt");

  return {
    txHash: tx.hash as Hex32,
    claimId: event.claimId,
    blockNumber: Number(receipt.blockNumber),
    gasUsed: BigInt(receipt.gasUsed),
    event,
  };
}

/** Parse the `ClaimSubmitted` event from a transaction receipt. */
export function parseClaimSubmittedEvent(
  receipt: ethers.TransactionReceipt | ethers.ContractTransactionReceipt,
  iface: ethers.Interface,
): ClaimSubmittedEvent | null {
  const topic = iface.getEvent("ClaimSubmitted")!.topicHash;
  for (const log of receipt.logs) {
    if (log.topics[0] !== topic) continue;
    const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
    if (!parsed) continue;
    return {
      claimId: BigInt(parsed.args.claimId),
      employerCommitment: parsed.args.employerCommitment as Hex32,
      timestampBucket: BigInt(parsed.args.timestampBucket),
      attestationDigest: parsed.args.attestationDigest as Hex32,
      issuer: parsed.args.issuer as Address,
    };
  }
  return null;
}

/**
 * Read a claim's encrypted `owedCents` handle and decrypt it via an active CoFHE
 * self-permit. Returns the decrypted amount in cents (USD).
 *
 * The caller's address must be either the worker (auto-allowed at submission)
 * or an attorney that the worker has granted access to via
 * `WageClaim.grantAttorneyAccess`.
 */
export async function decryptOwed(args: {
  client: WageShieldClient;
  provider: ethers.Provider;
  wageClaimAddress: Address;
  claimId: bigint;
}): Promise<bigint> {
  const { client, provider, wageClaimAddress, claimId } = args;
  await client.permits.getOrCreateSelfPermit();
  const wageClaim = new ethers.Contract(wageClaimAddress, WAGECLAIM_ABI, provider);
  const claim = await wageClaim.claims(claimId);
  const decrypted = await client
    .decryptForView(claim.owedCents, FheTypes.Uint128)
    .execute();
  return BigInt(decrypted as any);
}

/**
 * Read a claim's encrypted hours + rate handles in a single call. Same access
 * requirements as `decryptOwed`.
 */
export async function decryptHoursAndRate(args: {
  client: WageShieldClient;
  provider: ethers.Provider;
  wageClaimAddress: Address;
  claimId: bigint;
}): Promise<{ hoursWorked: bigint; hourlyRateCents: bigint; owedCents: bigint }> {
  const { client, provider, wageClaimAddress, claimId } = args;
  await client.permits.getOrCreateSelfPermit();
  const wageClaim = new ethers.Contract(wageClaimAddress, WAGECLAIM_ABI, provider);
  const claim = await wageClaim.claims(claimId);
  const [hours, rate, owed] = await Promise.all([
    client.decryptForView(claim.hoursWorked, FheTypes.Uint64).execute(),
    client.decryptForView(claim.hourlyRateCents, FheTypes.Uint32).execute(),
    client.decryptForView(claim.owedCents, FheTypes.Uint128).execute(),
  ]);
  return {
    hoursWorked: BigInt(hours as any),
    hourlyRateCents: BigInt(rate as any),
    owedCents: BigInt(owed as any),
  };
}

/**
 * Regulator-side: decrypt the per-employer aggregate exposure. The regulator must
 * have been registered (`addRegulator`) AND have called
 * `requestAggregateDecryption(employerCommitment)` first to get the ACL grant on
 * that specific aggregate handle.
 *
 * NOTE: when the per-employer aggregate is the sum of only N=1 claims, the regulator
 * effectively learns that single claim's amount. Production should enforce a
 * minimum-N k-anonymity gate before allowing the decrypt; v1 does not.
 */
export async function decryptAggregate(args: {
  client: WageShieldClient;
  provider: ethers.Provider;
  wageClaimAddress: Address;
  employerCommitment: Hex32;
}): Promise<bigint> {
  const { client, provider, wageClaimAddress, employerCommitment } = args;
  await client.permits.getOrCreateSelfPermit();
  const wageClaim = new ethers.Contract(wageClaimAddress, WAGECLAIM_ABI, provider);
  const aggHandle = await wageClaim.employerAggregateCents(employerCommitment);
  const decrypted = await client
    .decryptForView(aggHandle, FheTypes.Uint128)
    .execute();
  return BigInt(decrypted as any);
}

/**
 * Read claim metadata (the plaintext fields). Cheap view call — useful for the
 * attorney inbox and regulator dashboard.
 */
export async function readClaimMeta(args: {
  provider: ethers.Provider;
  wageClaimAddress: Address;
  claimId: bigint;
}) {
  const { provider, wageClaimAddress, claimId } = args;
  const wageClaim = new ethers.Contract(wageClaimAddress, WAGECLAIM_ABI, provider);
  const c = await wageClaim.claims(claimId);
  return {
    claimId,
    worker: c.worker as Address,
    employerCommitment: c.employerCommitment as Hex32,
    periodStart: BigInt(c.periodStart),
    periodEnd: BigInt(c.periodEnd),
    submittedAt: BigInt(c.submittedAt),
    timestampBucket: BigInt(c.timestampBucket),
    attestationDigest: c.attestationDigest as Hex32,
    issuer: c.issuer as Address,
    nonce: c.nonce as Hex32,
    disputed: Boolean(c.disputed),
    resolved: Boolean(c.resolved),
  };
}

/**
 * Worker grants an attorney decrypt access on a specific claim. Returns the tx hash.
 */
export async function grantAttorneyAccess(args: {
  signer: ethers.Signer;
  wageClaimAddress: Address;
  claimId: bigint;
  attorney: Address;
}): Promise<Hex32> {
  const { signer, wageClaimAddress, claimId, attorney } = args;
  const wageClaim = new ethers.Contract(wageClaimAddress, WAGECLAIM_ABI, signer);
  const tx = await wageClaim.grantAttorneyAccess(claimId, attorney);
  await tx.wait();
  return tx.hash as Hex32;
}

/**
 * Regulator requests aggregate-decrypt access on a specific employer's exposure.
 * Returns the tx hash. The regulator must have been registered first via
 * `addRegulator(...)` by the contract owner.
 */
export async function requestAggregateDecryption(args: {
  signer: ethers.Signer;
  wageClaimAddress: Address;
  employerCommitment: Hex32;
}): Promise<Hex32> {
  const { signer, wageClaimAddress, employerCommitment } = args;
  const wageClaim = new ethers.Contract(wageClaimAddress, WAGECLAIM_ABI, signer);
  const tx = await wageClaim.requestAggregateDecryption(employerCommitment);
  await tx.wait();
  return tx.hash as Hex32;
}
