// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint256, ebool, InEuint256} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/**
 * @title ConfidentialSpendPolicy
 * @notice Encrypted spend policy evaluation for Cognivern agent wallets.
 *
 * Holds encrypted budgets, encrypted spend counters, and encrypted approval
 * thresholds per (agent, policy). Evaluates incoming spend amounts under FHE
 * and emits a `SpendEvaluated` event whose `decisionId + attestation` is
 * consumed by the existing `GovernanceContract` on X Layer.
 */
contract ConfidentialSpendPolicy {
    struct EncryptedPolicy {
        euint256 dailyLimit;        // encrypted per-agent daily cap
        euint256 perTxLimit;        // encrypted per-tx cap
        euint256 approvalThreshold; // encrypted hold threshold
        bytes32 vendorSetRoot;      // commitment to encrypted vendor allowlist
        address operator;
        bool    initialized;
    }

    struct EncryptedCounter {
        euint256 spentToday;
        uint256 windowStart;        // plaintext UTC-day boundary (e.g. block.timestamp / 86400)
        bool    initialized;
    }

    enum Outcome { Deny, Hold, Approve }

    mapping(bytes32 => EncryptedPolicy)  public policies; // policyId -> policy
    mapping(bytes32 => EncryptedCounter) public counters; // agentId  -> counter

    event PolicyRegistered(bytes32 indexed policyId, address indexed operator);
    event SpendEvaluated(
        bytes32 indexed decisionId,
        bytes32 indexed agentId,
        bytes32 indexed policyId,
        Outcome outcome,
        bytes   attestation
    );

    /**
     * Register an encrypted policy.
     */
    function registerPolicy(
        bytes32 policyId,
        InEuint256 calldata dailyLimitCt,
        InEuint256 calldata perTxLimitCt,
        InEuint256 calldata approvalThresholdCt,
        bytes32 vendorSetRoot
    ) external {
        require(!policies[policyId].initialized, "policy exists");

        policies[policyId] = EncryptedPolicy({
            dailyLimit: FHE.asEuint256(dailyLimitCt),
            perTxLimit: FHE.asEuint256(perTxLimitCt),
            approvalThreshold: FHE.asEuint256(approvalThresholdCt),
            vendorSetRoot: vendorSetRoot,
            operator: msg.sender,
            initialized: true
        });

        emit PolicyRegistered(policyId, msg.sender);
    }

    /**
     * Evaluate an encrypted spend.
     */
    function evaluateSpend(
        bytes32 agentId,
        bytes32 policyId,
        InEuint256 calldata amountCt,
        bytes32 vendorHash
    ) external returns (bytes32 decisionId) {
        EncryptedPolicy storage p = policies[policyId];
        EncryptedCounter storage c = counters[agentId];

        require(p.initialized, "policy missing");

        euint256 amount = FHE.asEuint256(amountCt);

        // Reset counter if new day (simplistic window management)
        uint256 currentDay = block.timestamp / 86400;
        if (c.windowStart < currentDay) {
            c.spentToday = FHE.asEuint256(0);
            c.windowStart = currentDay;
            c.initialized = true;
        }

        euint256 newSpent = FHE.add(c.spentToday, amount);

        // FHE comparisons
        ebool underDaily    = FHE.lte(newSpent, p.dailyLimit);
        ebool underPerTx    = FHE.lte(amount, p.perTxLimit);
        ebool needsApproval = FHE.gt(amount, p.approvalThreshold);

        // Compute outcomes
        // approved: underDaily AND underPerTx AND NOT needsApproval
        ebool approved = FHE.and(underDaily, FHE.and(underPerTx, FHE.not(needsApproval)));
        // held: underDaily AND underPerTx AND needsApproval
        ebool held     = FHE.and(underDaily, FHE.and(underPerTx, needsApproval));

        // In a real Fhenix dApp, we would use threshold decryption or a callback to reveal the outcome.
        // For the hackathon demonstration, we will simplify: if we can't reveal the outcome on-chain
        // without a permit, we'll emit a "sealed" event or use FHE.decrypt (if operator is msg.sender).
        // For now, we'll assume the backend will decrypt the outcome using its permit.

        // Update counter only if not denied (approved or held)
        ebool notDenied = FHE.or(approved, held);
        c.spentToday = FHE.select(notDenied, newSpent, c.spentToday);

        decisionId = keccak256(
            abi.encode(agentId, policyId, vendorHash, block.number, msg.sender, amountCt)
        );

        // Placeholder: Outcome is encrypted; real impl would decrypt it for the event
        // or the backend would fetch it via permit.
        emit SpendEvaluated(decisionId, agentId, policyId, Outcome.Approve, "");
    }
}
