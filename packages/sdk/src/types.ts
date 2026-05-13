/**
 * Shared types for @wageshield/sdk.
 *
 * Mirrors the `WageClaim` Solidity ABI surface: identifiers are strongly typed,
 * numerics are `bigint` (uint64 / uint128 don't fit in number safely), and EIP-712
 * structs are kept symmetric with their Solidity hash inputs.
 */

/** 0x-prefixed 20-byte hex Ethereum address. */
export type Address = `0x${string}`;
/** 0x-prefixed 32-byte hex (transaction hash, EIP-712 digest, etc.). */
export type Hex32 = `0x${string}`;
/** 0x-prefixed bytes (signature, encoded data, …). */
export type HexBytes = `0x${string}`;

/**
 * EIP-712 `TimeclockAttestation` struct as the issuer signs it.
 *
 * NOTE: `employerId` is the keccak256 of the plaintext employer label. The label
 * itself is not part of the signed struct — the issuer signs a commitment, not a
 * disclosure. The plaintext label can be re-shared out-of-band by worker / attorney.
 */
export interface TimeclockAttestation {
  /** Worker's Ethereum address. The contract requires `msg.sender == worker`. */
  worker: Address;
  /** keccak256(utf8 bytes of employer label). */
  employerId: Hex32;
  /** Hours worked, plaintext. uint64. */
  hoursWorked: bigint;
  /** Hourly rate in cents (USD), plaintext. uint32. */
  hourlyRateCents: number;
  /** Period start, unix seconds. uint64. */
  periodStart: bigint;
  /** Period end, unix seconds. uint64. */
  periodEnd: bigint;
  /** When the issuer signed, unix seconds. uint64. */
  issuedAt: bigint;
  /** Random 32-byte nonce — replay protection per (issuer, nonce). */
  nonce: Hex32;
}

/**
 * EIP-712 domain WageClaim uses. The contract embeds these as constants so the
 * SDK can mirror them statically.
 */
export interface AttestationDomain {
  name: "WageShield.WageClaim";
  version: "1";
  chainId: number | bigint;
  verifyingContract: Address;
}

/** A signed attestation (struct + signature + signer + digest). */
export interface SignedAttestation {
  attestation: TimeclockAttestation;
  signature: HexBytes;
  signer: Address;
  digest: Hex32;
  domain: AttestationDomain;
}

/**
 * Inputs to `WageClaim.submitClaim`. The SDK expands this into the encrypted
 * `InEuint*` calldata + the attestation tuple.
 */
export interface SubmitClaimInput {
  /** A signed attestation from a trusted issuer. */
  signedAttestation: SignedAttestation;
}

/** Parsed `ClaimSubmitted` event. */
export interface ClaimSubmittedEvent {
  claimId: bigint;
  employerCommitment: Hex32;
  timestampBucket: bigint;
  attestationDigest: Hex32;
  issuer: Address;
}

/** Result of `submitClaim`. */
export interface SubmitClaimResult {
  txHash: Hex32;
  claimId: bigint;
  blockNumber: number;
  gasUsed: bigint;
  event: ClaimSubmittedEvent;
}

/**
 * Supported network names. Maps 1:1 to the hardhat network names and to the
 * `@cofhe/sdk/chains` exports.
 */
export type SupportedNetwork = "arb-sepolia" | "eth-sepolia" | "base-sepolia";
