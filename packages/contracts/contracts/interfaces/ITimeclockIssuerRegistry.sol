// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ITimeclockIssuerRegistry
/// @notice Registry of trusted issuers (mock Homebase / 7shifts / When-I-Work / worker-center
///         signers). The resolver consults this to verify SD-JWT VC signatures.
/// @dev v1 is owner-managed. v2 will move to a 5-of-7 quorum + 7-day timelock — see
///      docs/trust-list-governance.md.
interface ITimeclockIssuerRegistry {
    /// @notice Returns true if `issuer` is currently a trusted timeclock VC issuer.
    /// @param issuer The Ed25519/secp256k1 issuer Ethereum address.
    function isTrusted(address issuer) external view returns (bool);

    /// @notice Returns the human-readable label of a trusted issuer (e.g. "Homebase").
    /// @param issuer The issuer address.
    function labelOf(address issuer) external view returns (string memory);
}
