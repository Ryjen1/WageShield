/**
 * @wageshield/sdk
 *
 * Client SDK for WageShield: confidential wage-theft claims on Fhenix CoFHE.
 *
 * Public surface:
 *   • Types — `TimeclockAttestation`, `SignedAttestation`, `SubmitClaimResult`, …
 *   • Attestation — `buildAttestationDomain`, `buildAttestation`, `signAttestation`,
 *                   `attestationDigest`, `hashEmployerLabel`, `recoverAttestationSigner`.
 *   • CoFHE client — `createWageShieldClient`, `resolveCofheChain`.
 *   • Claim flow — `submitClaim`, `decryptOwed`, `decryptHoursAndRate`,
 *                  `decryptAggregate`, `readClaimMeta`, `grantAttorneyAccess`,
 *                  `requestAggregateDecryption`, `parseClaimSubmittedEvent`.
 *   • Constants — `WAGECLAIM_ABI`, `ATTESTATION_TYPES`, `SDK_VERSION`.
 */

export const SDK_VERSION = "0.1.0";

export * from "./types";
export * from "./attestation";
export * from "./client";
export * from "./claim";
export { WAGECLAIM_ABI } from "./abi";
