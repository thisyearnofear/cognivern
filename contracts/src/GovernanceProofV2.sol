// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title GovernanceProofV2
 * @notice Anchors Cognivern governance decisions to a verifiable evidence and
 *         policy-set commitment without publishing the underlying audit data.
 *
 * The contract deliberately does not execute transactions, hold funds, or
 * store the audit payload. Cognivern keeps the signed evidence off-chain and
 * publishes its commitments here so an auditor can verify that a receipt has
 * not been substituted after the fact.
 *
 * V2 changes from GovernanceProof:
 * - typed decision values instead of arbitrary strings;
 * - evidence and policy-set commitments for the current run/evidence model;
 * - duplicate-proof protection for retry-safe posting;
 * - separate admin and poster roles;
 * - two-step admin rotation;
 * - chain-recorded timestamp alongside the application timestamp;
 * - no public amount, vendor, action description, or stable workspace/agent
 *   identifiers by default.
 *
 * This contract is intentionally non-upgradeable. Deploy a new version rather
 * than changing the meaning of an existing proof stream.
 */
contract GovernanceProofV2 {
    uint8 public constant DECISION_APPROVED = 1;
    uint8 public constant DECISION_HELD = 2;
    uint8 public constant DECISION_STOPPED = 3;
    uint8 public constant SCHEMA_VERSION = 2;
    uint256 public constant MAX_FUTURE_SKEW = 5 minutes;

    /// @notice Address allowed to rotate the poster and admin roles.
    address public admin;

    /// @notice Narrowly scoped address allowed to publish proof commitments.
    address public poster;

    /// @notice Pending admin for two-step admin rotation.
    address public pendingAdmin;

    /// @notice Number of unique proofs recorded.
    uint256 public proofCount;

    /// @notice Block number at which a proof was recorded; zero means absent.
    mapping(bytes32 => uint256) public proofBlock;

    /// @notice Block number at which a run was first anchored; zero means absent.
    mapping(bytes32 => uint256) public runBlock;

    /// @notice Proof ID associated with the first anchor for a run.
    mapping(bytes32 => bytes32) public runProofId;

    event AdminTransferStarted(address indexed previousAdmin, address indexed pendingAdmin);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
    event PosterUpdated(address indexed previousPoster, address indexed newPoster);
    event AdminTransferCancelled(address indexed admin, address indexed pendingAdmin);

    /**
     * @notice Emitted when a decision commitment is recorded.
     *
     * `evidenceHash` commits to the canonical signed Cognivern evidence.
     * `policySetHash` commits to the exact policy/version set used by the
     * evaluator. The readable payload remains off-chain.
     */
    event GovernanceDecision(
        bytes32 indexed proofId,
        bytes32 indexed evidenceHash,
        bytes32 indexed policySetHash,
        uint8 decision,
        uint64 decisionTimestamp,
        uint64 recordedAt
    );

    error NotAdmin();
    error NotPoster();
    error ZeroAddress();
    error AdminTransferNotPending();
    error InvalidRunIdHash();
    error InvalidEvidenceHash();
    error InvalidPolicySetHash();
    error InvalidDecision();
    error InvalidDecisionTimestamp();
    error ProofAlreadyRecorded(bytes32 proofId);
    error RunAlreadyRecorded(bytes32 runIdHash, bytes32 proofId);
    error RolesMustBeSeparate();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyPoster() {
        if (msg.sender != poster) revert NotPoster();
        _;
    }

    constructor(address initialAdmin, address initialPoster) {
        if (initialAdmin == address(0) || initialPoster == address(0)) {
            revert ZeroAddress();
        }
        if (initialAdmin == initialPoster) revert RolesMustBeSeparate();

        admin = initialAdmin;
        poster = initialPoster;
        emit AdminTransferred(address(0), initialAdmin);
        emit PosterUpdated(address(0), initialPoster);
    }

    /**
     * @notice Record one governed decision commitment.
     *
     * The caller supplies a hash of Cognivern's run identity. The contract
     * derives the proofId from the schema version, run, evidence, and policy
     * commitments, so the idempotency key cannot be mismatched by the caller.
     *
     * `decisionTimestamp` is the application timestamp. `recordedAt` in the
     * event is taken from block.timestamp and is the chain-observed posting
     * time.
     */
    function recordDecision(
        bytes32 runIdHash,
        bytes32 evidenceHash,
        bytes32 policySetHash,
        uint8 decision,
        uint64 decisionTimestamp
    ) external onlyPoster returns (bytes32 proofId) {
        if (runIdHash == bytes32(0)) revert InvalidRunIdHash();
        if (evidenceHash == bytes32(0)) revert InvalidEvidenceHash();
        if (policySetHash == bytes32(0)) revert InvalidPolicySetHash();
        if (decision < DECISION_APPROVED || decision > DECISION_STOPPED) {
            revert InvalidDecision();
        }
        if (
            decisionTimestamp == 0 ||
            uint256(decisionTimestamp) > block.timestamp + MAX_FUTURE_SKEW
        ) {
            revert InvalidDecisionTimestamp();
        }
        proofId = computeProofId(
            runIdHash,
            evidenceHash,
            policySetHash,
            decision,
            decisionTimestamp
        );
        if (runBlock[runIdHash] != 0) {
            revert RunAlreadyRecorded(runIdHash, runProofId[runIdHash]);
        }
        if (proofBlock[proofId] != 0) revert ProofAlreadyRecorded(proofId);

        proofBlock[proofId] = block.number;
        runBlock[runIdHash] = block.number;
        runProofId[runIdHash] = proofId;
        proofCount++;

        emit GovernanceDecision(
            proofId,
            evidenceHash,
            policySetHash,
            decision,
            decisionTimestamp,
            uint64(block.timestamp)
        );

        return proofId;
    }

    /**
     * @notice Derive the canonical idempotency key for a proof.
     * @dev `abi.encode` is intentionally used instead of `abi.encodePacked` so
     *      the commitment cannot become ambiguous if the schema evolves.
     */
    function computeProofId(
        bytes32 runIdHash,
        bytes32 evidenceHash,
        bytes32 policySetHash,
        uint8 decision,
        uint64 decisionTimestamp
    ) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                SCHEMA_VERSION,
                block.chainid,
                address(this),
                runIdHash,
                evidenceHash,
                policySetHash,
                decision,
                decisionTimestamp
            )
        );
    }

    /**
     * @notice Start a two-step admin transfer.
     * @dev The pending admin must call acceptAdmin before control changes.
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert ZeroAddress();
        if (newAdmin == poster) revert RolesMustBeSeparate();
        pendingAdmin = newAdmin;
        emit AdminTransferStarted(admin, newAdmin);
    }

    /** @notice Complete a pending admin transfer. */
    function acceptAdmin() external {
        if (msg.sender != pendingAdmin) revert AdminTransferNotPending();

        address previousAdmin = admin;
        admin = msg.sender;
        pendingAdmin = address(0);
        emit AdminTransferred(previousAdmin, msg.sender);
    }

    /** @notice Cancel a pending admin transfer without changing the admin. */
    function cancelAdminTransfer() external onlyAdmin {
        address previousPendingAdmin = pendingAdmin;
        pendingAdmin = address(0);
        emit AdminTransferCancelled(admin, previousPendingAdmin);
    }

    /**
     * @notice Rotate the proof-poster key without changing admin control.
     * @dev A multisig can remain admin while the backend uses a dedicated
     *      narrow-scope poster key.
     */
    function setPoster(address newPoster) external onlyAdmin {
        if (newPoster == address(0)) revert ZeroAddress();
        if (newPoster == admin || newPoster == pendingAdmin) {
            revert RolesMustBeSeparate();
        }

        address previousPoster = poster;
        poster = newPoster;
        emit PosterUpdated(previousPoster, newPoster);
    }
}
