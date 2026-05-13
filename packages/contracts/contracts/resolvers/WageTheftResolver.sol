// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IConditionResolver} from "../interfaces/IConditionResolver.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {WageClaim} from "../WageClaim.sol";

/// @title WageTheftResolver
/// @notice Privara `IConditionResolver` for confidential wage-theft escrows. Releases when
///         (a) the linked WageClaim has not been disputed, OR (b) the dispute window has
///         lapsed without resolution, OR (c) a regulator/court has marked the claim
///         resolved-in-favour-of-worker.
/// @dev Pure plaintext lifecycle gating — the encrypted owed amount lives in `WageClaim`
///      and is paid out via Privara's `ConfidentialEscrow`, which only consults this
///      resolver's view for the binary release decision.
contract WageTheftResolver is IConditionResolver, ERC165 {
    /// @notice Window after submission during which the employer may submit a counter-
    ///         attestation (off-chain → `WageClaim.markDisputed`). After this window,
    ///         undisputed claims auto-release.
    uint64 public constant DISPUTE_WINDOW = 30 days;

    /// @notice Hard cap so escrows never sit forever. After this period, the escrow is
    ///         considered abandoned regardless of state and refunds to the funder via
    ///         Privara's standard timeout mechanism (out of resolver scope).
    uint64 public constant ABSOLUTE_TIMEOUT = 365 days;

    struct Config {
        WageClaim wageClaim;     // claim registry
        uint256 claimId;         // which claim funds this escrow
        uint64 createdAt;        // when this escrow's condition was set
    }

    mapping(uint256 => Config) public configs;

    event ConditionSet(
        uint256 indexed escrowId,
        address wageClaim,
        uint256 indexed claimId,
        uint64 createdAt
    );

    error InvalidWageClaim();
    error InvalidClaim(uint256 claimId);
    error ConditionAlreadySet();

    /// @inheritdoc IConditionResolver
    /// @dev `data` ABI: (address wageClaim, uint256 claimId).
    function onConditionSet(uint256 escrowId, bytes calldata data) external {
        if (configs[escrowId].createdAt != 0) revert ConditionAlreadySet();

        (address wageClaimAddr, uint256 claimId) = abi.decode(data, (address, uint256));
        if (wageClaimAddr == address(0)) revert InvalidWageClaim();

        WageClaim wc = WageClaim(wageClaimAddr);
        // Sanity-check: the claim exists.
        (address worker,,,,,,,,,,,) = _readClaim(wc, claimId);
        if (worker == address(0)) revert InvalidClaim(claimId);

        configs[escrowId] = Config({
            wageClaim: wc,
            claimId: claimId,
            createdAt: uint64(block.timestamp)
        });

        emit ConditionSet(escrowId, wageClaimAddr, claimId, uint64(block.timestamp));
    }

    /// @inheritdoc IConditionResolver
    /// @dev Release rules:
    ///        • If `claim.resolved` is true → release immediately.
    ///        • If `claim.disputed` is true → withhold (escrow waits for resolution).
    ///        • If `block.timestamp - createdAt < DISPUTE_WINDOW` → withhold (window open).
    ///        • Else (window lapsed, undisputed) → release.
    ///        • If `block.timestamp - createdAt > ABSOLUTE_TIMEOUT` → withhold (escrow
    ///          should be refunded by Privara's timeout path; this resolver no longer
    ///          authorises a worker payout).
    function isConditionMet(uint256 escrowId) external view returns (bool) {
        Config memory cfg = configs[escrowId];
        if (cfg.createdAt == 0) return false;

        uint64 nowTs = uint64(block.timestamp);
        if (nowTs > cfg.createdAt + ABSOLUTE_TIMEOUT) return false;

        (
            address worker,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            bool disputed,
            bool resolved,

        ) = _readClaim(cfg.wageClaim, cfg.claimId);

        if (worker == address(0)) return false; // claim removed / corrupt
        if (resolved) return true;
        if (disputed) return false;
        return nowTs >= cfg.createdAt + DISPUTE_WINDOW;
    }

    /// @inheritdoc ERC165
    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == type(IConditionResolver).interfaceId
            || super.supportsInterface(interfaceId);
    }

    // --------------------------------------------------------------------------------
    //  Internal helpers
    // --------------------------------------------------------------------------------

    /// @dev Reads the public-getter tuple of a `WageClaim.claims(id)` entry. The compiler
    ///      generates a getter that returns plaintext fields *and* the encrypted handles
    ///      (as their underlying uint values). We only consume the plaintext slice.
    function _readClaim(WageClaim wc, uint256 claimId)
        internal
        view
        returns (
            address worker,
            bytes32 employerCommitment,
            uint64 periodStart,
            uint64 periodEnd,
            uint64 submittedAt,
            uint64 timestampBucket,
            bytes32 attestationDigest,
            address issuer,
            bytes32 nonce,
            bool disputed,
            bool resolved,
            uint256 _placeholder
        )
    {
        (
            worker,
            employerCommitment,
            periodStart,
            periodEnd,
            submittedAt,
            timestampBucket,
            attestationDigest,
            issuer,
            nonce,
            disputed,
            resolved,
            ,
            ,

        ) = wc.claims(claimId);
        _placeholder = 0;
    }
}
