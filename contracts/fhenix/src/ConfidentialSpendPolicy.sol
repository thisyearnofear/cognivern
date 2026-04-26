// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// CoFHE imports — install with: pnpm add @fhenixprotocol/cofhe-contracts
// import {FHE, euint256, ebool, InEuint256} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/**
 * @title ConfidentialSpendPolicy
 * @notice Encrypted spend policy evaluation for Cognivern agent wallets.
 *
 * Holds encrypted budgets, encrypted spend counters, and encrypted approval
 * thresholds per (agent, policy). Evaluates incoming spend amounts under FHE
 * and emits a `SpendEvaluated` event whose `decisionId + attestation` is
 * consumed by the existing `GovernanceContract` on X Layer.
 *
 * Wave 1 scaffold: types and event surface only. Wave 2 fills in the
 * `FHE.lte` / `FHE.gt` / `FHE.select` calls and decryption callbacks.
 */
contract ConfidentialSpendPolicy {
    struct EncryptedPolicy {
        // euint256 dailyLimit;        // encrypted per-agent daily cap
        // euint256 perTxLimit;        // encrypted per-tx cap
        // euint256 approvalThreshold; // encrypted hold threshold
        bytes32 vendorSetRoot;         // commitment to encrypted vendor allowlist
        address operator;
        bool    initialized;
    }

    struct EncryptedCounter {
        // euint256 spentToday;
        uint256 windowStart;           // plaintext UTC-day boundary
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
     * Register an encrypted policy. In wave 2 this accepts `InEuint256`
     * ciphertexts for limits and assigns them with `FHE.asEuint256(...)`.
     */
    function registerPolicy(bytes32 policyId, bytes32 vendorSetRoot) external {
        require(!policies[policyId].initialized, "policy exists");
        policies[policyId] = EncryptedPolicy({
            vendorSetRoot: vendorSetRoot,
            operator: msg.sender,
            initialized: true
        });
        emit PolicyRegistered(policyId, msg.sender);
    }

    /**
     * Evaluate an encrypted spend. Wave 1 stub returns Deny; wave 2 performs
     * the FHE comparisons and emits the real outcome + attestation.
     */
    function evaluateSpend(
        bytes32 agentId,
        bytes32 policyId,
        bytes calldata amountCt,    // wave 2: InEuint256 calldata
        bytes32 vendorHash
    ) external returns (bytes32 decisionId) {
        require(policies[policyId].initialized, "policy missing");
        decisionId = keccak256(
            abi.encode(agentId, policyId, vendorHash, block.number, msg.sender, amountCt)
        );
        emit SpendEvaluated(decisionId, agentId, policyId, Outcome.Deny, "");
    }
}
