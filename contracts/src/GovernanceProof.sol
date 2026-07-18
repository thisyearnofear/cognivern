// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title GovernanceProof
 * @notice Records AI agent governance decisions on 0G Chain.
 *         Every time Cognivern evaluates a spend action, a proof is
 *         posted here so anyone can verify the decision on-chain.
 *
 * @dev This contract is intentionally minimal — it stores nothing,
 *      only emits events. The event log IS the audit trail. This
 *      keeps gas costs low and makes proofs instantly verifiable
 *      on ChainScan without reading contract state.
 */
contract GovernanceProof {
    /// @notice Emitted when a governance decision is recorded
    event GovernanceDecision(
        bytes32 indexed decisionHash,  // keccak256(workspaceId, agentId, actionType, amount, decision, timestamp)
        bytes32 indexed workspaceId,   // workspace ID (keccak256 hash)
        bytes32 indexed agentId,       // agent ID (keccak256 hash)
        string  actionType,            // "swap", "transfer", "stake", etc.
        uint256 amount,                // spend amount in smallest unit
        string  currency,              // "USDC", "ETH", etc.
        string  decision,              // "approved", "denied", "held"
        uint256 timestamp              // evaluation timestamp (unix seconds)
    );

    /// @notice Address authorized to post proofs (Cognivern backend)
    address public authority;

    /// @notice Total proofs recorded
    uint256 public proofCount;

    event AuthorityTransferred(address indexed previous, address indexed current);

    modifier onlyAuthority() {
        require(msg.sender == authority, "Not authorized");
        _;
    }

    constructor() {
        authority = msg.sender;
        emit AuthorityTransferred(address(0), msg.sender);
    }

    /**
     * @notice Record a governance decision on-chain.
     * @param workspaceId  keccak256 hash of the workspace ID
     * @param agentId      keccak256 hash of the agent ID
     * @param actionType   The action type (swap, transfer, stake, etc.)
     * @param amount       The spend amount
     * @param currency     The currency (USDC, ETH, etc.)
     * @param decision     The decision (approved, denied, held)
     * @param timestamp    The evaluation timestamp
     * @return decisionHash keccak256 hash of the full decision
     */
    function recordDecision(
        bytes32 workspaceId,
        bytes32 agentId,
        string calldata actionType,
        uint256 amount,
        string calldata currency,
        string calldata decision,
        uint256 timestamp
    ) external onlyAuthority returns (bytes32 decisionHash) {
        decisionHash = keccak256(
            abi.encodePacked(
                workspaceId,
                agentId,
                actionType,
                amount,
                currency,
                decision,
                timestamp
            )
        );

        proofCount++;
        emit GovernanceDecision(
            decisionHash,
            workspaceId,
            agentId,
            actionType,
            amount,
            currency,
            decision,
            timestamp
        );
    }

    /**
     * @notice Transfer authority to a new address.
     * @param newAuthority The new authority address
     */
    function transferAuthority(address newAuthority) external onlyAuthority {
        require(newAuthority != address(0), "Zero address");
        emit AuthorityTransferred(authority, newAuthority);
        authority = newAuthority;
    }
}
