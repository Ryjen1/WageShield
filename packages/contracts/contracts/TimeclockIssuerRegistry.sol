// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ITimeclockIssuerRegistry} from "./interfaces/ITimeclockIssuerRegistry.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title TimeclockIssuerRegistry
/// @notice Registry of trusted timeclock VC issuers (mock Homebase / 7shifts / When-I-Work /
///         worker-center signers). Owner-managed in v1.
/// @dev v2 moves to a 5-of-7 quorum + 7-day timelock (24h expedited revoke) as
///      documented in docs/trust-list-governance.md.
contract TimeclockIssuerRegistry is ITimeclockIssuerRegistry, Ownable {
    /// @notice Issuer address => trust flag.
    mapping(address => bool) private _trusted;
    /// @notice Issuer address => human-readable label.
    mapping(address => string) private _label;

    event IssuerTrusted(address indexed issuer, string label);
    event IssuerRevoked(address indexed issuer);

    error EmptyLabel();
    error AlreadyTrusted();
    error NotTrusted();

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Add a trusted issuer.
    /// @param issuer Ethereum address of the issuer's signing key.
    /// @param label Human-readable label (e.g. "Homebase Sandbox").
    function trustIssuer(address issuer, string calldata label) external onlyOwner {
        if (bytes(label).length == 0) revert EmptyLabel();
        if (_trusted[issuer]) revert AlreadyTrusted();

        _trusted[issuer] = true;
        _label[issuer] = label;
        emit IssuerTrusted(issuer, label);
    }

    /// @notice Revoke a trusted issuer.
    function revokeIssuer(address issuer) external onlyOwner {
        if (!_trusted[issuer]) revert NotTrusted();

        _trusted[issuer] = false;
        delete _label[issuer];
        emit IssuerRevoked(issuer);
    }

    /// @inheritdoc ITimeclockIssuerRegistry
    function isTrusted(address issuer) external view returns (bool) {
        return _trusted[issuer];
    }

    /// @inheritdoc ITimeclockIssuerRegistry
    function labelOf(address issuer) external view returns (string memory) {
        return _label[issuer];
    }
}
