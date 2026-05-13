/**
 * @wageshield/sdk — main (browser-safe) entry point.
 *
 * Exports types, EIP-712 attestation helpers, ABI fragments, and the high-level
 * claim-flow helpers (`submitClaim`, `decryptOwed`, `grantAttorneyAccess`, …).
 *
 * The Node-only CoFHE client constructor (which transitively imports
 * `@cofhe/sdk/node` + `Ethers6Adapter`, and therefore Node's `fs` module) lives at
 * the separate `@wageshield/sdk/node` subpath. Browser apps construct their own
 * CoFHE client via `@cofhe/sdk/web` and pass the resulting client into the
 * claim-flow helpers exported here.
 *
 * Public surface (this entry):
 *   • Types — `TimeclockAttestation`, `SignedAttestation`, `SubmitClaimResult`, …
 *   • Attestation — `buildAttestationDomain`, `buildAttestation`, `signAttestation`,
 *                   `attestationDigest`, `hashEmployerLabel`, `recoverAttestationSigner`.
 *   • Claim flow — `submitClaim`, `decryptOwed`, `decryptHoursAndRate`,
 *                  `decryptAggregate`, `readClaimMeta`, `grantAttorneyAccess`,
 *                  `requestAggregateDecryption`, `parseClaimSubmittedEvent`.
 *   • Constants — `WAGECLAIM_ABI`, `ATTESTATION_TYPES`, `SDK_VERSION`.
 *
 * Node-only entry (`@wageshield/sdk/node`):
 *   • `createWageShieldClient`, `resolveCofheChain` — CoFHE client construction.
 */

export const SDK_VERSION = "0.1.0";

export * from "./types";
export * from "./attestation";
export * from "./claim";
export { WAGECLAIM_ABI } from "./abi";

// NOTE: do NOT re-export from "./client" here — that pulls in @cofhe/sdk/node which
// uses Node's `fs` module and breaks browser bundles. Use `@wageshield/sdk/node`
// instead. See `client.ts` for the doc-comment surface; consumers can also import
// the underlying types via:
//   import type { WageShieldClient } from "@wageshield/sdk/node";
