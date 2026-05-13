// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {euint64, ebool} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/// @title IUnderwriterPolicy
/// @notice Interface for Privara FHE-based insurance policy plugins.
/// @dev Verbatim copy of Privara v0.1 interface — do not modify.
///      Source: https://github.com/ReineiraOS/reineira-code
interface IUnderwriterPolicy {
    /// @notice Called when coverage is purchased. Store policy-specific data.
    /// @param coverageId The coverage identifier.
    /// @param data ABI-encoded policy configuration.
    function onPolicySet(uint256 coverageId, bytes calldata data) external;

    /// @notice Return an encrypted risk score (0-10000 basis points).
    /// @dev 100 bps = 1% premium. Score determines buyer's premium.
    /// @param escrowId The escrow identifier this risk score applies to.
    /// @param riskProof ABI-encoded evidence used by the policy to score risk.
    /// @return riskScore Encrypted basis-point risk score.
    function evaluateRisk(uint256 escrowId, bytes calldata riskProof)
        external
        returns (euint64 riskScore);

    /// @notice Judge a dispute. Return encrypted boolean (true = valid claim).
    /// @param coverageId The coverage identifier under dispute.
    /// @param disputeProof ABI-encoded evidence supporting the dispute.
    /// @return valid Encrypted boolean — true if claim is valid, else false.
    function judge(uint256 coverageId, bytes calldata disputeProof)
        external
        returns (ebool valid);
}
