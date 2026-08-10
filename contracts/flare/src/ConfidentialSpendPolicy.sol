// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { ITeeExtensionRegistry } from "./interfaces/ITeeExtensionRegistry.sol";
import { ITeeMachineRegistry } from "./interfaces/ITeeMachineRegistry.sol";

/**
 * @title ConfidentialSpendPolicy
 * @notice Flare Confidential Compute (FCC) InstructionSender for Cognivern
 *         confidential spend-policy evaluation.
 *
 * Port of the Fhenix ConfidentialSpendPolicy product surface onto Flare's
 * TEE-based Flare Compute Extension (FCE) stack:
 *   - Budget limits + spend counters live as TEE-private state (not public
 *     contract storage), so remaining budget is not readable on-chain.
 *   - Evaluation runs inside the enclave; only approve / hold / deny is
 *     published back on-chain via publishDecision.
 *   - SpendEvaluated event shape matches the Fhenix contract so the Cognivern
 *     backend dispatch path can stay isomorphic behind a feature flag.
 *
 * DO NOT MODIFY: constructor, setExtensionId(), _getExtensionId() — required
 * by the FCC registration flow (see flare-foundation/fce-extension-scaffold).
 *
 * Constructor args on Coston2 are both the FlareTeeManager diamond
 * (0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE).
 */
contract ConfidentialSpendPolicy {
    /// @notice Operation type for spend-policy actions.
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_TYPE_SPEND_POLICY = bytes32("SPEND_POLICY");

    /// @notice Seed / update a policy's confidential limits inside the TEE.
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_COMMAND_REGISTER_POLICY = bytes32("REGISTER_POLICY");

    /// @notice Evaluate a spend against TEE-held budget + counters.
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_COMMAND_EVALUATE_SPEND = bytes32("EVALUATE_SPEND");

    ITeeExtensionRegistry public immutable TEE_EXTENSION_REGISTRY;
    ITeeMachineRegistry public immutable TEE_MACHINE_REGISTRY;

    uint256 private constant FIRST_PUBLIC_EXTENSION_ID = 0x10000; // 65536
    uint256 private _extensionId;

    address public owner;
    address public pendingOwner;
    mapping(address => bool) public authorizedEvaluators;

    enum Outcome {
        Deny,
        Hold,
        Approve,
        Pending
    }

    struct PendingDecision {
        bytes32 agentId;
        bytes32 policyId;
        bytes32 vendorHash;
        address submitter;
        bytes32 instructionId;
    }

    mapping(bytes32 => Outcome) public resolvedOutcomes;
    mapping(bytes32 => PendingDecision) public pendingDecisions;
    mapping(bytes32 => bool) public policyRegistered; // policyId -> seen on-chain

    event PolicyRegistered(bytes32 indexed policyId, address indexed operator);
    event SpendEvaluated(
        bytes32 indexed decisionId,
        bytes32 indexed agentId,
        bytes32 indexed policyId,
        Outcome outcome,
        bytes attestation
    );
    event DecisionResolved(bytes32 indexed decisionId, Outcome outcome);
    event EvaluatorAuthorized(address indexed evaluator);
    event EvaluatorRevoked(address indexed evaluator);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyAuthorized() {
        require(msg.sender == owner || authorizedEvaluators[msg.sender], "not authorized");
        _;
    }

    /// @notice Initializes with FCC registry addresses (FlareTeeManager diamond on Coston2).
    constructor(
        ITeeExtensionRegistry _teeExtensionRegistry,
        ITeeMachineRegistry _teeMachineRegistry
    ) {
        require(address(_teeExtensionRegistry) != address(0), "TeeExtensionRegistry cannot be zero address");
        require(address(_teeMachineRegistry) != address(0), "TeeMachineRegistry cannot be zero address");
        require(address(_teeExtensionRegistry).code.length > 0, "TeeExtensionRegistry has no code");
        require(address(_teeMachineRegistry).code.length > 0, "TeeMachineRegistry has no code");

        TEE_EXTENSION_REGISTRY = _teeExtensionRegistry;
        TEE_MACHINE_REGISTRY = _teeMachineRegistry;
        owner = msg.sender;
        authorizedEvaluators[msg.sender] = true;
    }

    /// @notice Finds and caches this contract's extension id. Can only be set once.
    /// DO NOT MODIFY this function.
    function setExtensionId() external {
        require(_extensionId == 0, "Extension ID already set.");
        uint256 c = TEE_EXTENSION_REGISTRY.nextPublicExtensionId();
        for (uint256 i = FIRST_PUBLIC_EXTENSION_ID; i < c; ++i) {
            if (TEE_EXTENSION_REGISTRY.getTeeExtensionInstructionsSender(i) == address(this)) {
                _extensionId = i;
                return;
            }
        }
        revert("Extension ID not found.");
    }

    function extensionId() external view returns (uint256) {
        return _getExtensionId();
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero address");
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "not pending owner");
        address previousOwner = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(previousOwner, owner);
    }

    function authorizeEvaluator(address evaluator) external onlyOwner {
        authorizedEvaluators[evaluator] = true;
        emit EvaluatorAuthorized(evaluator);
    }

    function revokeEvaluator(address evaluator) external onlyOwner {
        authorizedEvaluators[evaluator] = false;
        emit EvaluatorRevoked(evaluator);
    }

    /**
     * @notice Register (or refresh) a confidential policy inside the TEE.
     * @param policyId Cognivern policy id.
     * @param message ABI/JSON payload for the TEE REGISTER_POLICY handler
     *        (dailyLimit, perTxLimit, approvalThreshold). Relayed once via
     *        FCC; thereafter limits live only in TEE state.
     */
    function registerPolicy(bytes32 policyId, bytes calldata message) external payable onlyAuthorized {
        require(policyId != bytes32(0), "empty policyId");
        require(message.length > 0, "empty message");

        _send(OP_COMMAND_REGISTER_POLICY, message);
        policyRegistered[policyId] = true;

        emit PolicyRegistered(policyId, msg.sender);
    }

    /**
     * @notice Request confidential spend evaluation inside the TEE.
     * @dev Emits SpendEvaluated with Outcome.Pending. Caller (or watcher)
     *      later calls publishDecision once the TEE result is available from
     *      the extension proxy.
     * @param agentId Cognivern agent id.
     * @param policyId Cognivern policy id (must have been registerPolicy'd).
     * @param vendorHash Hash of vendor identity (matches Fhenix surface).
     * @param message TEE EVALUATE_SPEND payload (agentId, policyId, amount, vendorHash).
     * @return decisionId Deterministic id for this evaluation request.
     */
    function evaluateSpend(
        bytes32 agentId,
        bytes32 policyId,
        bytes32 vendorHash,
        bytes calldata message
    ) external payable onlyAuthorized returns (bytes32 decisionId) {
        require(policyRegistered[policyId], "policy missing");
        require(message.length > 0, "empty message");

        bytes32 instructionId = _send(OP_COMMAND_EVALUATE_SPEND, message);

        decisionId = keccak256(
            abi.encode(agentId, policyId, vendorHash, block.number, msg.sender, instructionId)
        );

        pendingDecisions[decisionId] = PendingDecision({
            agentId: agentId,
            policyId: policyId,
            vendorHash: vendorHash,
            submitter: msg.sender,
            instructionId: instructionId
        });
        resolvedOutcomes[decisionId] = Outcome.Pending;

        emit SpendEvaluated(decisionId, agentId, policyId, Outcome.Pending, abi.encodePacked(instructionId));
    }

    /**
     * @notice Publish the TEE evaluation result on-chain.
     * @dev Closes the Pending → Approve|Hold|Deny loop. Attestation should be
     *      the TEE result bytes (or a hash thereof) for CRE evidence.
     */
    function publishDecision(
        bytes32 decisionId,
        Outcome outcome,
        bytes calldata attestation
    ) external onlyAuthorized {
        require(
            outcome == Outcome.Deny || outcome == Outcome.Hold || outcome == Outcome.Approve,
            "invalid outcome"
        );
        PendingDecision storage pending = pendingDecisions[decisionId];
        require(pending.submitter != address(0), "unknown decision");
        require(resolvedOutcomes[decisionId] == Outcome.Pending, "already resolved");

        resolvedOutcomes[decisionId] = outcome;
        emit DecisionResolved(decisionId, outcome);
        emit SpendEvaluated(decisionId, pending.agentId, pending.policyId, outcome, attestation);
    }

    function isDecisionApproved(bytes32 decisionId) external view returns (bool) {
        return resolvedOutcomes[decisionId] == Outcome.Approve;
    }

    function _send(bytes32 opCommand, bytes calldata message) internal returns (bytes32 instructionId) {
        address[] memory teeIds = TEE_MACHINE_REGISTRY.getRandomTeeIds(_getExtensionId(), 1);
        address[] memory cosigners = new address[](0);

        ITeeExtensionRegistry.TeeInstructionParams memory params = ITeeExtensionRegistry.TeeInstructionParams({
            opType: OP_TYPE_SPEND_POLICY,
            opCommand: opCommand,
            message: message,
            cosigners: cosigners,
            cosignersThreshold: 0,
            claimBackAddress: msg.sender
        });

        instructionId = TEE_EXTENSION_REGISTRY.sendInstructions{ value: msg.value }(teeIds, params);
    }

    /// @notice Returns the cached extension ID, reverting if not yet set.
    function _getExtensionId() internal view returns (uint256) {
        require(_extensionId != 0, "Extension ID is not set.");
        return _extensionId;
    }
}
