/**
 * Minimal embedded ABI fragments. Keeping the SDK self-contained (no runtime
 * dependency on the contracts package's typechain output) means consumers can
 * `npm install @wageshield/sdk` without pulling in Hardhat.
 *
 * If the Solidity surface changes, regenerate by hand from the artifact JSON
 * (`packages/contracts/artifacts/contracts/WageClaim.sol/WageClaim.json`) and
 * keep these in sync — there's a unit-style assertion in `claim.ts` that fails
 * fast if the function names drift.
 */

export const WAGECLAIM_ABI = [
  // --- write functions ----------------------------------------------------
  {
    type: "function",
    name: "submitClaim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "employerId", type: "bytes32" },
      { name: "attestedHoursWorked", type: "uint64" },
      { name: "attestedRateCents", type: "uint32" },
      { name: "periodStart", type: "uint64" },
      { name: "periodEnd", type: "uint64" },
      { name: "issuedAt", type: "uint64" },
      { name: "nonce", type: "bytes32" },
      { name: "issuerSignature", type: "bytes" },
      {
        name: "eHours",
        type: "tuple",
        components: [
          { name: "ctHash", type: "uint256" },
          { name: "securityZone", type: "uint8" },
          { name: "utype", type: "uint8" },
          { name: "signature", type: "bytes" },
        ],
      },
      {
        name: "eRateCents",
        type: "tuple",
        components: [
          { name: "ctHash", type: "uint256" },
          { name: "securityZone", type: "uint8" },
          { name: "utype", type: "uint8" },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    outputs: [{ name: "claimId", type: "uint256" }],
  },
  {
    type: "function",
    name: "grantAttorneyAccess",
    stateMutability: "nonpayable",
    inputs: [
      { name: "claimId", type: "uint256" },
      { name: "attorney", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revokeAttorneyAccess",
    stateMutability: "nonpayable",
    inputs: [
      { name: "claimId", type: "uint256" },
      { name: "attorney", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "addRegulator",
    stateMutability: "nonpayable",
    inputs: [{ name: "regulator", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "requestAggregateDecryption",
    stateMutability: "nonpayable",
    inputs: [{ name: "employerCommitment", type: "bytes32" }],
    outputs: [],
  },
  // --- view functions -----------------------------------------------------
  {
    type: "function",
    name: "claims",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "worker", type: "address" },
      { name: "employerCommitment", type: "bytes32" },
      { name: "periodStart", type: "uint64" },
      { name: "periodEnd", type: "uint64" },
      { name: "submittedAt", type: "uint64" },
      { name: "timestampBucket", type: "uint64" },
      { name: "attestationDigest", type: "bytes32" },
      { name: "issuer", type: "address" },
      { name: "nonce", type: "bytes32" },
      { name: "disputed", type: "bool" },
      { name: "resolved", type: "bool" },
      { name: "hoursWorked", type: "uint256" },
      { name: "hourlyRateCents", type: "uint256" },
      { name: "owedCents", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "employerAggregateCents",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "employerClaimCount",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "attorneyAccess",
    stateMutability: "view",
    inputs: [
      { name: "claimId", type: "uint256" },
      { name: "attorney", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "isRegulator",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "TIMESTAMP_BUCKET",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }],
  },
  // --- events -------------------------------------------------------------
  {
    type: "event",
    name: "ClaimSubmitted",
    inputs: [
      { name: "claimId", type: "uint256", indexed: true },
      { name: "employerCommitment", type: "bytes32", indexed: true },
      { name: "timestampBucket", type: "uint64", indexed: true },
      { name: "attestationDigest", type: "bytes32", indexed: false },
      { name: "issuer", type: "address", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AttorneyAccessGranted",
    inputs: [
      { name: "claimId", type: "uint256", indexed: true },
      { name: "attorney", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "AggregateExposed",
    inputs: [
      { name: "employerCommitment", type: "bytes32", indexed: true },
      { name: "regulator", type: "address", indexed: true },
    ],
  },
] as const;
