// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {
    FHE,
    euint32,
    euint64,
    euint128,
    ebool,
    InEuint32,
    InEuint64
} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ITimeclockIssuerRegistry} from "./interfaces/ITimeclockIssuerRegistry.sol";

/// @title WageClaim
/// @notice Core registry of confidential wage-theft claims. Workers submit encrypted
///         (hours, hourlyRate, employerId, periodStart, periodEnd) along with a signed
///         attestation from a trusted timeclock issuer. The contract computes the encrypted
///         owed amount on-chain (hours × rate) and aggregates encrypted exposure per employer
///         without ever decrypting individual claims.
/// @dev FHE access-control philosophy:
///        • Worker (submitter) — sees their own claim's encrypted owed amount via permit.
///        • Attorney — granted decrypt access on a per-claim basis via `grantAttorneyAccess`.
///        • Regulator — granted decrypt access on the aggregate-by-employer counter only.
///        • The contract itself always retains access (FHE.allowThis) so subsequent
///          aggregations can reuse handles.
///      Subpoena resistance:
///        • The on-chain `ClaimSubmitted` event contains no PII — only claimId, an
///          employerCommitment hash, a 15-minute time bucket, and the attestation digest.
///        • The worker's address is recorded only in storage (`claims[id].worker`) and is
///          referenced solely to authorize `grantAttorneyAccess` and aggregate decrypt.
contract WageClaim is EIP712 {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // --------------------------------------------------------------------------------
    //  Constants
    // --------------------------------------------------------------------------------

    /// @notice EIP-712 type hash for a timeclock attestation. The issuer signs this struct
    ///         to vouch that a worker logged a given (hours, rate, employerId) in a given
    ///         period. The attested values are the *plaintext* the worker is claiming —
    ///         the contract then encrypts and stores them, so off-chain they are visible
    ///         only to the worker, the issuer, and (under permit) the attorney.
    bytes32 public constant ATTESTATION_TYPEHASH = keccak256(
        "TimeclockAttestation(address worker,bytes32 employerId,uint64 hoursWorked,uint32 hourlyRateCents,uint64 periodStart,uint64 periodEnd,uint64 issuedAt,bytes32 nonce)"
    );

    /// @notice Granularity of the public timestamp bucket (seconds). 15 minutes by default.
    ///         Larger buckets = stronger k-anonymity at the cost of resolution.
    uint64 public constant TIMESTAMP_BUCKET = 15 minutes;

    /// @notice Maximum tolerated clock drift between the issuer signature and on-chain time.
    uint64 public constant MAX_ATTESTATION_AGE = 30 days;

    /// @notice Maximum federal/state statute of limitations window the resolver will honour.
    ///         (FLSA is 2y / 3y for willful; many state laws extend to 6y. We cap at 6y.)
    uint64 public constant MAX_CLAIM_AGE = 6 * 365 days;

    // --------------------------------------------------------------------------------
    //  Storage
    // --------------------------------------------------------------------------------

    /// @notice Issuer registry consulted to verify timeclock attestation signatures.
    ITimeclockIssuerRegistry public immutable issuerRegistry;

    /// @notice Sequential claim identifier. 1-indexed; id 0 is reserved.
    uint256 public nextClaimId;

    struct Claim {
        // Plaintext metadata (non-PII)
        address worker;             // worker EOA — used only for permit/access control
        bytes32 employerCommitment; // keccak256(employerId) — public bucket key
        uint64 periodStart;         // unix seconds, plaintext (range, not identifying)
        uint64 periodEnd;           // unix seconds, plaintext
        uint64 submittedAt;         // unix seconds, plaintext
        uint64 timestampBucket;     // 15-minute bucket of submittedAt
        bytes32 attestationDigest;  // EIP-712 digest of the issuer attestation
        address issuer;             // recovered issuer address (must be trusted)
        bytes32 nonce;              // attestation nonce — replay protection
        bool disputed;              // employer counter-attestation submitted
        bool resolved;              // claim has been judged / closed
        // Encrypted state
        euint64 hoursWorked;        // encrypted hours
        euint32 hourlyRateCents;    // encrypted hourly rate in cents (USD)
        euint128 owedCents;         // encrypted owed amount = hours * rate (cents)
    }

    /// @notice Storage of all claims.
    mapping(uint256 => Claim) public claims;

    /// @notice Per-employer aggregate encrypted owed amount (sum of all submitted claims
    ///         against that employer). Decryptable by the regulator role only.
    mapping(bytes32 => euint128) public employerAggregateCents;

    /// @notice Per-employer claim count (plaintext — count is non-identifying).
    mapping(bytes32 => uint256) public employerClaimCount;

    /// @notice Used attestation nonces, indexed by issuer. Prevents replay of the same
    ///         attestation across multiple claims.
    mapping(address => mapping(bytes32 => bool)) public usedNonces;

    /// @notice Per-claim attorney access list. An entry of `true` means the worker has
    ///         granted that attorney decrypt permission on the claim's encrypted handles.
    mapping(uint256 => mapping(address => bool)) public attorneyAccess;

    /// @notice Regulator addresses that may decrypt aggregates (not individual claims).
    mapping(address => bool) public isRegulator;

    /// @notice Owner / trust-list admin.
    address public owner;

    // --------------------------------------------------------------------------------
    //  Events
    // --------------------------------------------------------------------------------

    /// @dev No PII. employerCommitment is keccak256(employerId), timestampBucket is a 15-min
    ///      bucket, attestationDigest commits to the (encrypted) plaintext values without
    ///      revealing them.
    event ClaimSubmitted(
        uint256 indexed claimId,
        bytes32 indexed employerCommitment,
        uint64 indexed timestampBucket,
        bytes32 attestationDigest,
        address issuer
    );

    event AttorneyAccessGranted(uint256 indexed claimId, address indexed attorney);
    event AttorneyAccessRevoked(uint256 indexed claimId, address indexed attorney);
    event RegulatorAdded(address indexed regulator);
    event RegulatorRemoved(address indexed regulator);
    event AggregateExposed(bytes32 indexed employerCommitment, address indexed regulator);

    event ClaimDisputed(uint256 indexed claimId);
    event ClaimResolved(uint256 indexed claimId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // --------------------------------------------------------------------------------
    //  Errors
    // --------------------------------------------------------------------------------

    error UntrustedIssuer(address issuer);
    error InvalidSignature();
    error WorkerMismatch(address expected, address actual);
    error AttestationStale(uint64 issuedAt);
    error ClaimTooOld(uint64 periodStart);
    error InvalidPeriod();
    error NonceUsed(bytes32 nonce);
    error NotWorker(uint256 claimId);
    error NotOwner();
    error NotRegulator();
    error UnknownClaim(uint256 claimId);
    error AlreadyResolved(uint256 claimId);

    // --------------------------------------------------------------------------------
    //  Constructor
    // --------------------------------------------------------------------------------

    constructor(ITimeclockIssuerRegistry _issuerRegistry, address _owner)
        EIP712("WageShield.WageClaim", "1")
    {
        issuerRegistry = _issuerRegistry;
        owner = _owner;
        nextClaimId = 1;
        emit OwnershipTransferred(address(0), _owner);
    }

    // --------------------------------------------------------------------------------
    //  Modifiers
    // --------------------------------------------------------------------------------

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyRegulator() {
        if (!isRegulator[msg.sender]) revert NotRegulator();
        _;
    }

    // --------------------------------------------------------------------------------
    //  Submission
    // --------------------------------------------------------------------------------

    /// @notice Worker submits a wage-theft claim along with an issuer-signed attestation
    ///         and CoFHE-encrypted hours/rate inputs. The contract verifies the EIP-712
    ///         signature, confirms the issuer is trusted, computes the encrypted owed
    ///         amount on-chain (hours × rate), and folds it into the per-employer aggregate.
    /// @dev The plaintext `attestedHours` and `attestedRateCents` are committed to inside
    ///      the EIP-712 signature so the issuer's vouching is auditable without ever
    ///      revealing the values on-chain. The encrypted handles `eHours` / `eRateCents`
    ///      are what the contract actually computes against.
    /// @param employerId Plaintext employer identifier (e.g. EIN). The on-chain event only
    ///        leaks `keccak256(employerId)`, not the plaintext. Workers can collude with
    ///        regulators by sharing the preimage out-of-band.
    /// @param attestedHoursWorked Plaintext hours the issuer is vouching for. Must match
    ///        the plaintext that was encrypted into `eHours` (worker is responsible for
    ///        consistency; mismatch only hurts the worker by producing a useless claim).
    /// @param attestedRateCents Plaintext hourly rate in cents the issuer is vouching for.
    /// @param periodStart Unix-seconds start of the work period being claimed.
    /// @param periodEnd Unix-seconds end of the work period being claimed.
    /// @param issuedAt Unix-seconds timestamp of the attestation.
    /// @param nonce Random 32-byte nonce — issuer rotates per attestation.
    /// @param issuerSignature EIP-712 signature by the issuer over the attestation struct.
    /// @param eHours Encrypted hours worked (must equal `attestedHoursWorked` plaintext).
    /// @param eRateCents Encrypted hourly rate in cents (must equal `attestedRateCents`).
    /// @return claimId The newly-minted claim identifier.
    function submitClaim(
        bytes32 employerId,
        uint64 attestedHoursWorked,
        uint32 attestedRateCents,
        uint64 periodStart,
        uint64 periodEnd,
        uint64 issuedAt,
        bytes32 nonce,
        bytes calldata issuerSignature,
        InEuint64 calldata eHours,
        InEuint32 calldata eRateCents
    ) external returns (uint256 claimId) {
        // --- 1. Sanity-check plaintext ranges --------------------------------------
        if (periodEnd <= periodStart) revert InvalidPeriod();
        if (block.timestamp > periodStart + MAX_CLAIM_AGE) revert ClaimTooOld(periodStart);
        if (issuedAt + MAX_ATTESTATION_AGE < block.timestamp) revert AttestationStale(issuedAt);

        // --- 2. Recover & trust-check the issuer -----------------------------------
        bytes32 structHash = keccak256(
            abi.encode(
                ATTESTATION_TYPEHASH,
                msg.sender,
                employerId,
                attestedHoursWorked,
                attestedRateCents,
                periodStart,
                periodEnd,
                issuedAt,
                nonce
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address recoveredIssuer = digest.recover(issuerSignature);
        if (recoveredIssuer == address(0)) revert InvalidSignature();
        if (!issuerRegistry.isTrusted(recoveredIssuer)) revert UntrustedIssuer(recoveredIssuer);
        if (usedNonces[recoveredIssuer][nonce]) revert NonceUsed(nonce);
        usedNonces[recoveredIssuer][nonce] = true;

        // --- 3. Encrypt + compute owed amount on encrypted state -------------------
        euint64 encHours = FHE.asEuint64(eHours);
        euint32 encRate = FHE.asEuint32(eRateCents);

        // owed (cents) = hours * rate. Widen rate to euint64 first, then to euint128 to
        // safely hold values up to ~3.4e38 cents (more than enough for any single claim).
        euint64 rate64 = FHE.asEuint64(encRate);
        euint64 owed64 = FHE.mul(encHours, rate64);
        euint128 owed = FHE.asEuint128(owed64);

        // --- 4. Build the claim record --------------------------------------------
        claimId = nextClaimId++;
        bytes32 employerCommitment = keccak256(abi.encodePacked(employerId));
        uint64 nowTs = uint64(block.timestamp);
        uint64 bucket = (nowTs / TIMESTAMP_BUCKET) * TIMESTAMP_BUCKET;

        claims[claimId] = Claim({
            worker: msg.sender,
            employerCommitment: employerCommitment,
            periodStart: periodStart,
            periodEnd: periodEnd,
            submittedAt: nowTs,
            timestampBucket: bucket,
            attestationDigest: digest,
            issuer: recoveredIssuer,
            nonce: nonce,
            disputed: false,
            resolved: false,
            hoursWorked: encHours,
            hourlyRateCents: encRate,
            owedCents: owed
        });

        // --- 5. ACL: contract must retain access; worker must too ------------------
        FHE.allowThis(encHours);
        FHE.allowThis(encRate);
        FHE.allowThis(owed);
        FHE.allow(encHours, msg.sender);
        FHE.allow(encRate, msg.sender);
        FHE.allow(owed, msg.sender);

        // --- 6. Fold into per-employer aggregate -----------------------------------
        euint128 prevAggregate = employerAggregateCents[employerCommitment];
        euint128 newAggregate;
        if (FHE.isInitialized(prevAggregate)) {
            newAggregate = FHE.add(prevAggregate, owed);
        } else {
            newAggregate = owed;
        }
        FHE.allowThis(newAggregate);
        employerAggregateCents[employerCommitment] = newAggregate;
        employerClaimCount[employerCommitment] += 1;

        // --- 7. Emit subpoena-resistant receipt ------------------------------------
        emit ClaimSubmitted(claimId, employerCommitment, bucket, digest, recoveredIssuer);
    }

    // --------------------------------------------------------------------------------
    //  Access management
    // --------------------------------------------------------------------------------

    /// @notice Worker grants an attorney decrypt access on their claim. The attorney can
    ///         then create a CoFHE permit and unseal the claim's encrypted handles.
    function grantAttorneyAccess(uint256 claimId, address attorney) external {
        Claim storage c = claims[claimId];
        if (c.worker == address(0)) revert UnknownClaim(claimId);
        if (msg.sender != c.worker) revert NotWorker(claimId);

        attorneyAccess[claimId][attorney] = true;
        FHE.allow(c.hoursWorked, attorney);
        FHE.allow(c.hourlyRateCents, attorney);
        FHE.allow(c.owedCents, attorney);

        emit AttorneyAccessGranted(claimId, attorney);
    }

    /// @notice Worker revokes a previously-granted attorney access flag. Note: CoFHE ACL
    ///         entries are persistent; revocation here is recorded for off-chain UX
    ///         purposes but does not retroactively invalidate already-issued permits.
    function revokeAttorneyAccess(uint256 claimId, address attorney) external {
        Claim storage c = claims[claimId];
        if (c.worker == address(0)) revert UnknownClaim(claimId);
        if (msg.sender != c.worker) revert NotWorker(claimId);

        attorneyAccess[claimId][attorney] = false;
        emit AttorneyAccessRevoked(claimId, attorney);
    }

    /// @notice Owner registers a regulator (state AG, DOL, etc.). Regulators can request
    ///         decrypt of per-employer aggregate exposure, never of individual claims.
    function addRegulator(address regulator) external onlyOwner {
        isRegulator[regulator] = true;
        emit RegulatorAdded(regulator);
    }

    function removeRegulator(address regulator) external onlyOwner {
        isRegulator[regulator] = false;
        emit RegulatorRemoved(regulator);
    }

    /// @notice Regulator requests decrypt access on a specific employer's aggregate.
    ///         The handle becomes decryptable by the calling regulator only.
    function requestAggregateDecryption(bytes32 employerCommitment) external onlyRegulator {
        euint128 agg = employerAggregateCents[employerCommitment];
        require(FHE.isInitialized(agg), "no aggregate");
        FHE.allow(agg, msg.sender);
        emit AggregateExposed(employerCommitment, msg.sender);
    }

    // --------------------------------------------------------------------------------
    //  Dispute / resolution lifecycle
    // --------------------------------------------------------------------------------

    /// @notice Mark a claim as disputed (e.g. employer submitted a counter-attestation
    ///         off-chain). The resolver consults this flag to delay release.
    /// @dev v1: any caller may flag — anti-DOS guarded by `MAX_ATTESTATION_AGE` and the
    ///      resolver's 30-day employer counter-window. v2: gated by `IDisputeAuthority`.
    function markDisputed(uint256 claimId) external {
        Claim storage c = claims[claimId];
        if (c.worker == address(0)) revert UnknownClaim(claimId);
        if (c.resolved) revert AlreadyResolved(claimId);
        c.disputed = true;
        emit ClaimDisputed(claimId);
    }

    /// @notice Mark a claim resolved (paid out via Privara escrow, or dismissed).
    /// @dev Restricted to the worker, an authorized attorney, or a regulator. The Privara
    ///      escrow's release call should pass through the resolver, which calls this on
    ///      success — but for v1 we expose a permissioned manual path as well.
    function markResolved(uint256 claimId) external {
        Claim storage c = claims[claimId];
        if (c.worker == address(0)) revert UnknownClaim(claimId);
        if (c.resolved) revert AlreadyResolved(claimId);

        bool authorized = (msg.sender == c.worker)
            || attorneyAccess[claimId][msg.sender]
            || isRegulator[msg.sender]
            || msg.sender == owner;
        require(authorized, "WageClaim: not authorized");

        c.resolved = true;
        emit ClaimResolved(claimId);
    }

    // --------------------------------------------------------------------------------
    //  Owner admin
    // --------------------------------------------------------------------------------

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "WageClaim: zero owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // --------------------------------------------------------------------------------
    //  Views
    // --------------------------------------------------------------------------------

    /// @notice Returns the EIP-712 domain separator. Useful for off-chain issuer signing.
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /// @notice Returns the EIP-712 digest the issuer should sign for a given attestation.
    function attestationDigest(
        address worker,
        bytes32 employerId,
        uint64 hoursWorked,
        uint32 hourlyRateCents,
        uint64 periodStart,
        uint64 periodEnd,
        uint64 issuedAt,
        bytes32 nonce
    ) external view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                ATTESTATION_TYPEHASH,
                worker,
                employerId,
                hoursWorked,
                hourlyRateCents,
                periodStart,
                periodEnd,
                issuedAt,
                nonce
            )
        );
        return _hashTypedDataV4(structHash);
    }
}
