/**
 * EIP-712 attestation helpers.
 *
 * The issuer signs a `TimeclockAttestation` struct against the WageClaim contract's
 * EIP-712 domain. The struct commits to (worker, employerId hash, hours, rate, period,
 * issuedAt, nonce). Workers attach this signature to `submitClaim` so the contract can
 * verify the issuer is registered + the nonce is fresh.
 *
 * This module is **pure**: no network, no signing key. Use `signAttestation` to actually
 * sign, but it's separate so consumers can plug in custom signers (HSMs, embedded wallets,
 * remote signers).
 */
import { ethers } from "ethers";
import type {
  Address,
  AttestationDomain,
  Hex32,
  SignedAttestation,
  TimeclockAttestation,
} from "./types";

/**
 * EIP-712 type definitions for `TimeclockAttestation`. Mirror of the Solidity
 * `ATTESTATION_TYPEHASH` field order in `WageClaim.sol`.
 *
 * Not `as const` because ethers' typed-data API expects a mutable
 * `Record<string, TypedDataField[]>`. Treat as immutable by convention.
 */
export const ATTESTATION_TYPES: Record<string, ethers.TypedDataField[]> = {
  TimeclockAttestation: [
    { name: "worker", type: "address" },
    { name: "employerId", type: "bytes32" },
    { name: "hoursWorked", type: "uint64" },
    { name: "hourlyRateCents", type: "uint32" },
    { name: "periodStart", type: "uint64" },
    { name: "periodEnd", type: "uint64" },
    { name: "issuedAt", type: "uint64" },
    { name: "nonce", type: "bytes32" },
  ],
};

/** Build the EIP-712 domain object for a deployed `WageClaim`. */
export function buildAttestationDomain(args: {
  chainId: number | bigint;
  wageClaimAddress: Address;
}): AttestationDomain {
  return {
    name: "WageShield.WageClaim",
    version: "1",
    chainId: args.chainId,
    verifyingContract: args.wageClaimAddress,
  };
}

/**
 * Hash a plaintext employer label to its 32-byte commitment used everywhere on-chain.
 * Equivalent to `keccak256(utf8 bytes(label))`.
 */
export function hashEmployerLabel(label: string): Hex32 {
  return ethers.id(label) as Hex32;
}

/**
 * Compute the EIP-712 digest the issuer would sign. Useful for off-line verification
 * and for passing to remote signers that only sign raw digests.
 */
export function attestationDigest(
  domain: AttestationDomain,
  attestation: TimeclockAttestation,
): Hex32 {
  return ethers.TypedDataEncoder.hash(
    domain as unknown as ethers.TypedDataDomain,
    ATTESTATION_TYPES,
    attestation,
  ) as Hex32;
}

/**
 * Build an unsigned `TimeclockAttestation` with sensible defaults. `issuedAt` defaults
 * to now, `nonce` to a fresh 32-byte random value. Both can be overridden for
 * deterministic testing.
 */
export function buildAttestation(args: {
  worker: Address;
  employerLabel: string;
  hoursWorked: bigint;
  hourlyRateCents: number;
  periodStart: bigint;
  periodEnd: bigint;
  issuedAt?: bigint;
  nonce?: Hex32;
}): TimeclockAttestation {
  if (args.periodEnd <= args.periodStart) {
    throw new Error("buildAttestation: periodEnd must exceed periodStart");
  }
  return {
    worker: args.worker,
    employerId: hashEmployerLabel(args.employerLabel),
    hoursWorked: args.hoursWorked,
    hourlyRateCents: args.hourlyRateCents,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    issuedAt: args.issuedAt ?? BigInt(Math.floor(Date.now() / 1000)),
    nonce: (args.nonce ?? (ethers.hexlify(ethers.randomBytes(32)) as Hex32)),
  };
}

/**
 * Sign a `TimeclockAttestation` with an ethers `Signer`. Returns the bundle the
 * worker needs to attach to `submitClaim`.
 *
 * The signer's address must be (or become) a trusted issuer on the deployed
 * `TimeclockIssuerRegistry`, otherwise `submitClaim` will revert with
 * `UntrustedIssuer(address)`.
 */
export async function signAttestation(args: {
  signer: ethers.Signer;
  domain: AttestationDomain;
  attestation: TimeclockAttestation;
}): Promise<SignedAttestation> {
  const { signer, domain, attestation } = args;
  const signature = (await signer.signTypedData(
    domain as unknown as ethers.TypedDataDomain,
    ATTESTATION_TYPES,
    attestation,
  )) as `0x${string}`;
  const signerAddr = (await signer.getAddress()) as Address;
  return {
    attestation,
    signature,
    signer: signerAddr,
    digest: attestationDigest(domain, attestation),
    domain,
  };
}

/**
 * Verify the signer of a signed attestation matches the claimed `signer` field.
 * Useful for clients that received a `SignedAttestation` over an untrusted channel
 * and want to double-check before submitting.
 */
export function recoverAttestationSigner(signed: SignedAttestation): Address {
  const recovered = ethers.verifyTypedData(
    signed.domain as unknown as ethers.TypedDataDomain,
    ATTESTATION_TYPES,
    signed.attestation,
    signed.signature,
  );
  return recovered as Address;
}
