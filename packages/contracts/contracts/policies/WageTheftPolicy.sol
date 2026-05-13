// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IUnderwriterPolicy} from "../interfaces/IUnderwriterPolicy.sol";
import {FHE, euint64, ebool} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";

/// @title WageTheftPolicy
/// @notice Privara `IUnderwriterPolicy` for confidential wage-theft coverage. Settlement
///         pools (plaintiff law-firm advances, state AG funds, class-action bonds) buy
///         coverage on a worker's escrow; the policy returns an encrypted risk score
///         used to price the premium and an encrypted boolean judgment when the worker
///         disputes the employer's counter-attestation.
/// @dev Risk scoring is intentionally simple in v1: the underwriter picks a baseline
///      basis-point score per coverage at policy-set time (e.g. 250 bps for low-risk
///      industries, 800 bps for high-turnover ones). v2 will fold in encrypted history
///      across the per-employer aggregate from `WageClaim.employerAggregateCents`.
contract WageTheftPolicy is IUnderwriterPolicy, ERC165 {
    struct PolicyConfig {
        uint64 baseRiskScore;     // 0-10000 bps
        uint64 disputeMaxAgeDays; // judge() only accepts disputes filed within N days
        bool configured;
    }

    mapping(uint256 => PolicyConfig) public policies;

    event PolicySet(uint256 indexed coverageId, uint64 baseRiskScore, uint64 disputeMaxAgeDays);
    event RiskEvaluated(uint256 indexed escrowId);
    event Judged(uint256 indexed coverageId);

    error PolicyAlreadySet();
    error PolicyNotConfigured();
    error InvalidRiskScore();
    error InvalidDisputeWindow();

    /// @inheritdoc IUnderwriterPolicy
    /// @dev `data` ABI: (uint64 baseRiskScore, uint64 disputeMaxAgeDays).
    function onPolicySet(uint256 coverageId, bytes calldata data) external {
        if (policies[coverageId].configured) revert PolicyAlreadySet();

        (uint64 baseRiskScore, uint64 disputeMaxAgeDays) = abi.decode(data, (uint64, uint64));
        if (baseRiskScore > 10_000) revert InvalidRiskScore();
        if (disputeMaxAgeDays == 0 || disputeMaxAgeDays > 365) revert InvalidDisputeWindow();

        policies[coverageId] = PolicyConfig({
            baseRiskScore: baseRiskScore,
            disputeMaxAgeDays: disputeMaxAgeDays,
            configured: true
        });

        emit PolicySet(coverageId, baseRiskScore, disputeMaxAgeDays);
    }

    /// @inheritdoc IUnderwriterPolicy
    /// @dev v1 returns a fixed encrypted baseline. The encrypted return type means buyers
    ///      see the bps figure but external observers (e.g. competing underwriters) do
    ///      not — preserving competitive pricing.
    function evaluateRisk(uint256 coverageId, bytes calldata)
        external
        returns (euint64 riskScore)
    {
        PolicyConfig memory p = policies[coverageId];
        if (!p.configured) revert PolicyNotConfigured();

        euint64 encrypted = FHE.asEuint64(p.baseRiskScore);
        FHE.allowThis(encrypted);
        FHE.allow(encrypted, msg.sender);
        emit RiskEvaluated(coverageId);
        return encrypted;
    }

    /// @inheritdoc IUnderwriterPolicy
    /// @dev `disputeProof` ABI: (bool workerProvidedEvidence, uint256 disputeFiledAt).
    ///      For v1 we accept the plaintext flag and only validate timing. v2 will accept
    ///      a structured proof (encrypted signed counter-attestation from a second issuer,
    ///      or zkTLS proof of the worker's bank statement absence of payment).
    function judge(uint256 coverageId, bytes calldata disputeProof)
        external
        returns (ebool valid)
    {
        PolicyConfig memory p = policies[coverageId];
        if (!p.configured) revert PolicyNotConfigured();

        (bool workerProvidedEvidence, uint256 disputeFiledAt) =
            abi.decode(disputeProof, (bool, uint256));

        bool inWindow = disputeFiledAt <= block.timestamp
            && (block.timestamp - disputeFiledAt) <= p.disputeMaxAgeDays * 1 days;
        bool result = workerProvidedEvidence && inWindow;

        ebool encrypted = FHE.asEbool(result);
        FHE.allowThis(encrypted);
        FHE.allow(encrypted, msg.sender);
        emit Judged(coverageId);
        return encrypted;
    }

    /// @inheritdoc ERC165
    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == type(IUnderwriterPolicy).interfaceId
            || super.supportsInterface(interfaceId);
    }
}
