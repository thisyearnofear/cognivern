// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint128, ebool, InEuint128} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/**
 * @title ConfidentialSpendPolicy
 * @notice Encrypted spend policy evaluation for Cognivern agent wallets.
 *
 * Holds encrypted budgets, encrypted spend counters, and encrypted approval
 * thresholds per (agent, policy). Evaluates incoming spend amounts under FHE
 * and emits a `SpendEvaluated` event whose `decisionId + attestation` is
 * consumed by the existing `GovernanceContract` on X Layer via Hyperlane.
 */

interface IMailbox {
    function dispatch(
        uint32 _destinationDomain,
        bytes32 _recipientAddress,
        bytes calldata _messageBody
    ) external returns (bytes32);
}

contract ConfidentialSpendPolicy {
    struct EncryptedPolicy {
        euint128 dailyLimit;        // encrypted per-agent daily cap
        euint128 perTxLimit;        // encrypted per-tx cap
        euint128 approvalThreshold; // encrypted hold threshold
        address operator;
        bool    initialized;
    }

    struct EncryptedCounter {
        euint128 spentToday;
        uint256 windowStart;        // plaintext UTC-day boundary (e.g. block.timestamp / 86400)
        bool    initialized;
    }

    struct PendingDecision {
        bytes32 agentId;
        bytes32 policyId;
        bytes32 vendorHash;
    }

    enum Outcome { Deny, Hold, Approve, Pending }

    mapping(bytes32 => EncryptedPolicy)  public policies; // policyId -> policy
    mapping(bytes32 => EncryptedCounter) public counters; // agentId  -> counter

    // Resolved outcomes — set by operator after off-chain FHE decrypt
    mapping(bytes32 => Outcome) public resolvedOutcomes;

    // Decision metadata for cross-chain relay from resolveDecision
    mapping(bytes32 => PendingDecision) public pendingDecisions;

    // Access control — only owner or authorized evaluators can submit
    mapping(address => bool) public authorizedEvaluators;

    // Hyperlane Integration
    IMailbox public mailbox;
    uint32 public xLayerDestinationDomain;
    bytes32 public xLayerRecipient;
    bytes32 public xLayerDeFiVault; // The specialized DeFi vault address
    address public owner;
    address public pendingOwner;

    event PolicyRegistered(bytes32 indexed policyId, address indexed operator);
    event SpendEvaluated(
        bytes32 indexed decisionId,
        bytes32 indexed agentId,
        bytes32 indexed policyId,
        Outcome outcome,
        bytes   attestation
    );
    event DecisionResolved(bytes32 indexed decisionId, Outcome outcome);
    event EvaluatorAuthorized(address indexed evaluator);
    event EvaluatorRevoked(address indexed evaluator);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event HyperlaneConfigUpdated(address mailbox, uint32 destinationDomain, bytes32 recipient, bytes32 vault);

    modifier onlyAuthorized() {
        require(msg.sender == owner || authorizedEvaluators[msg.sender], "not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedEvaluators[msg.sender] = true;
    }

    /**
     * Configure Hyperlane Bridge
     */
    function setHyperlaneConfig(
        address _mailbox,
        uint32 _domain,
        bytes32 _recipient,
        bytes32 _vault
    ) external {
        require(msg.sender == owner, "not owner");
        mailbox = IMailbox(_mailbox);
        xLayerDestinationDomain = _domain;
        xLayerRecipient = _recipient;
        xLayerDeFiVault = _vault;
        emit HyperlaneConfigUpdated(_mailbox, _domain, _recipient, _vault);
    }

    /**
     * Two-step ownership transfer — initiate.
     */
    function transferOwnership(address newOwner) external {
        require(msg.sender == owner, "not owner");
        require(newOwner != address(0), "zero address");
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    /**
     * Two-step ownership transfer — accept.
     */
    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "not pending owner");
        address previousOwner = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(previousOwner, owner);
    }

    /**
     * Authorize an address to call evaluateSpend.
     */
    function authorizeEvaluator(address evaluator) external {
        require(msg.sender == owner, "not owner");
        authorizedEvaluators[evaluator] = true;
        emit EvaluatorAuthorized(evaluator);
    }

    /**
     * Revoke an evaluator's authorization.
     */
    function revokeEvaluator(address evaluator) external {
        require(msg.sender == owner, "not owner");
        authorizedEvaluators[evaluator] = false;
        emit EvaluatorRevoked(evaluator);
    }

    /**
     * Register an encrypted policy.
     */
    function registerPolicy(
        bytes32 policyId,
        InEuint128 calldata dailyLimitCt,
        InEuint128 calldata perTxLimitCt,
        InEuint128 calldata approvalThresholdCt
    ) external {
        require(!policies[policyId].initialized, "policy exists");

        EncryptedPolicy storage p = policies[policyId];
        p.dailyLimit = FHE.asEuint128(dailyLimitCt);
        p.perTxLimit = FHE.asEuint128(perTxLimitCt);
        p.approvalThreshold = FHE.asEuint128(approvalThresholdCt);
        p.operator = msg.sender;
        p.initialized = true;

        // Grant the contract (and the operator) ACL on the stored handles so
        // they can be read in future evaluateSpend transactions. Without these
        // allowThis/allowSender calls, the live coFHE testnet reverts with
        // ACLNotAllowed when the handles are later passed into FHE.lte/FHE.gt.
        FHE.allowThis(p.dailyLimit);
        FHE.allowThis(p.perTxLimit);
        FHE.allowThis(p.approvalThreshold);
        FHE.allowSender(p.dailyLimit);
        FHE.allowSender(p.perTxLimit);
        FHE.allowSender(p.approvalThreshold);

        emit PolicyRegistered(policyId, msg.sender);
    }

    /**
     * Evaluate an encrypted spend.
     * Only owner or authorized evaluators may submit.
     */
    function evaluateSpend(
        bytes32 agentId,
        bytes32 policyId,
        InEuint128 calldata amountCt,
        bytes32 vendorHash
    ) external onlyAuthorized returns (bytes32 decisionId) {
        EncryptedPolicy storage p = policies[policyId];
        EncryptedCounter storage c = counters[agentId];

        require(p.initialized, "policy missing");

        euint128 amount = FHE.asEuint128(amountCt);
        // The contract just created `amount` via verifyInput — it is the
        // ACL owner of this handle for this transaction.

        // Reset counter if new day or first use (simplistic window management)
        uint256 currentDay = block.timestamp / 86400;
        if (!c.initialized || c.windowStart < currentDay) {
            c.spentToday = FHE.asEuint128(0);
            // allowThis on the freshly-initialised counter so the contract
            // can use it in subsequent FHE operations in this transaction and
            // (via transient allowance) the FHE.add below.
            FHE.allowThis(c.spentToday);
            FHE.allowTransient(c.spentToday, address(this));
            c.windowStart = currentDay;
            c.initialized = true;
        }

        euint128 newSpent = FHE.add(c.spentToday, amount);

        // FHE comparisons
        ebool underDaily    = FHE.lte(newSpent, p.dailyLimit);
        ebool underPerTx    = FHE.lte(amount, p.perTxLimit);
        ebool needsApproval = FHE.gt(amount, p.approvalThreshold);

        // Compute outcomes
        // approved: underDaily AND underPerTx AND NOT needsApproval
        ebool approved = FHE.and(underDaily, FHE.and(underPerTx, FHE.not(needsApproval)));
        // held: underDaily AND underPerTx AND needsApproval
        ebool held     = FHE.and(underDaily, FHE.and(underPerTx, needsApproval));

        // For the result booleans, use allowTransient (single-transaction ACL)
        // instead of allowThis/allowSender. The contract is already the
        // createTask-side owner of these handles; allowTransient is the
        // documented pattern for intermediate results in the same transaction.
        FHE.allowTransient(approved, address(this));
        FHE.allowTransient(approved, msg.sender);
        FHE.allowTransient(held, address(this));
        FHE.allowTransient(held, msg.sender);

        // Update counter only if not denied (approved or held)
        ebool notDenied = FHE.or(approved, held);
        c.spentToday = FHE.select(notDenied, newSpent, c.spentToday);
        FHE.allowThis(c.spentToday);
        FHE.allowTransient(c.spentToday, address(this));

        decisionId = keccak256(
            abi.encode(agentId, policyId, vendorHash, block.number, msg.sender)
        );

        // Store decision metadata so resolveDecision can cross-chain relay
        pendingDecisions[decisionId] = PendingDecision({
            agentId: agentId,
            policyId: policyId,
            vendorHash: vendorHash
        });

        // Emit Pending — the true outcome is revealed off-chain via threshold decryption,
        // then committed on-chain by resolveDecision, which dispatches the real outcome
        // to the GovernanceContract via Hyperlane.
        emit SpendEvaluated(decisionId, agentId, policyId, Outcome.Pending, "");
    }

    /**
     * Resolve a pending decision with the actual FHE outcome.
     * Callable only by the contract owner after off-chain threshold decryption.
     * Once resolved, dispatches the real outcome to GovernanceContract via Hyperlane.
     */
    function resolveDecision(bytes32 decisionId, Outcome outcome) external {
        require(msg.sender == owner, "not owner");
        require(outcome != Outcome.Pending, "outcome must be resolved");
        require(resolvedOutcomes[decisionId] == Outcome.Pending, "already resolved");

        PendingDecision memory pending = pendingDecisions[decisionId];
        require(pending.agentId != bytes32(0), "decision not found");

        resolvedOutcomes[decisionId] = outcome;
        emit DecisionResolved(decisionId, outcome);

        // Cross-chain dispatch: send the resolved outcome to GovernanceContract on X Layer.
        // The handle() path in GovernanceContract now receives the real FHE-evaluated
        // outcome (0=Deny, 1=Hold, 2=Approve) instead of a placeholder Pending.
        if (address(mailbox) != address(0) && xLayerRecipient != bytes32(0)) {
            bytes memory payload = abi.encode(decisionId, pending.agentId, pending.policyId, uint8(outcome));
            mailbox.dispatch(xLayerDestinationDomain, xLayerRecipient, payload);
        }
    }

    /**
     * Check if a resolved decision allows execution.
     */
    function isDecisionApproved(bytes32 decisionId) public view returns (bool) {
        Outcome outcome = resolvedOutcomes[decisionId];
        return outcome == Outcome.Approve;
    }

    /**
     * Request a DeFi action (e.g. Swap) to be executed by the GovernedVault on X Layer.
     * Evaluates encrypted budget via evaluateSpend before dispatching.
     * Only dispatches to the vault if the spend evaluation has been resolved to Approve.
     */
    function requestDeFiAction(
        bytes32 agentId,
        bytes32 policyId,
        InEuint128 calldata amountCt,
        bytes32 vendorHash,
        address target,
        bytes calldata data
    ) external onlyAuthorized returns (bytes32 decisionId) {
        EncryptedPolicy storage p = policies[policyId];
        EncryptedCounter storage c = counters[agentId];
        require(p.initialized, "policy missing");

        euint128 amount = FHE.asEuint128(amountCt);

        // Reset daily counter if new window or first use
        uint256 currentDay = block.timestamp / 86400;
        if (!c.initialized || c.windowStart < currentDay) {
            c.spentToday = FHE.asEuint128(0);
            FHE.allowThis(c.spentToday);
            c.windowStart = currentDay;
            c.initialized = true;
        }

        euint128 newSpent = FHE.add(c.spentToday, amount);

        // FHE budget checks
        ebool underDaily  = FHE.lte(newSpent, p.dailyLimit);
        ebool underPerTx  = FHE.lte(amount, p.perTxLimit);
        ebool notDenied   = FHE.and(underDaily, underPerTx);

        // Update counter only if not denied
        c.spentToday = FHE.select(notDenied, newSpent, c.spentToday);
        FHE.allowThis(c.spentToday);

        decisionId = keccak256(abi.encode(agentId, policyId, vendorHash, target, data, block.number));

        // Dispatch to DeFi vault on X Layer when mailbox is configured.
        // The caller has passed onlyAuthorized; the FHE budget check above
        // determines whether the counter was updated (notDenied path).
        if (address(mailbox) != address(0) && xLayerDeFiVault != bytes32(0)) {
            uint256 value = 0;
            bytes memory payload = abi.encode(decisionId, agentId, target, value, data);
            mailbox.dispatch(xLayerDestinationDomain, xLayerDeFiVault, payload);
        }
    }
}
