// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {CBOR} from "solidity-cborutils/contracts/CBOR.sol";

/**
 * @title GovernanceContract
 * @dev Core governance contract for AI agent policy enforcement on Filecoin
 */
contract GovernanceContract {
    using CBOR for CBOR.CBORBuffer;

    struct Policy {
        bytes32 id;
        string name;
        string description;
        bytes32 rulesHash; // IPFS hash of policy rules
        address creator;
        uint256 createdAt;
        uint256 updatedAt;
        PolicyStatus status;
    }

    struct Agent {
        bytes32 id;
        string name;
        address owner;
        string[] capabilities;
        uint256 registeredAt;
        AgentStatus status;
        bytes32 currentPolicyId;
    }

    struct GovernanceAction {
        bytes32 id;
        bytes32 agentId;
        bytes32 policyId;
        string actionType;
        bytes32 dataHash; // IPFS hash of action data
        bool approved;
        uint256 timestamp;
        address evaluator;
    }

    enum PolicyStatus { Draft, Active, Archived }
    enum AgentStatus { Registered, Active, Suspended, Deregistered }

    // State variables
    mapping(bytes32 => Policy) public policies;
    mapping(bytes32 => Agent) public agents;
    mapping(bytes32 => GovernanceAction) public actions;
    mapping(address => bool) public authorizedEvaluators;

    bytes32[] public policyIds;
    bytes32[] public agentIds;
    bytes32[] public actionIds;

    address public owner;
    uint256 public totalPolicies;
    uint256 public totalAgents;
    uint256 public totalActions;

    // Events
    event PolicyCreated(bytes32 indexed policyId, string name, address creator);
    event PolicyUpdated(bytes32 indexed policyId, PolicyStatus status);
    event AgentRegistered(bytes32 indexed agentId, string name, address owner);
    event AgentStatusChanged(bytes32 indexed agentId, AgentStatus status);
    event ActionEvaluated(bytes32 indexed actionId, bytes32 agentId, bool approved);
    event EvaluatorAuthorized(address evaluator);
    event EvaluatorRevoked(address evaluator);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier onlyAuthorizedEvaluator() {
        require(authorizedEvaluators[msg.sender], "Not authorized evaluator");
        _;
    }

    modifier onlyAgentOwner(bytes32 agentId) {
        require(agents[agentId].owner == msg.sender, "Not agent owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedEvaluators[msg.sender] = true;
    }

    /**
     * @dev Create a new governance policy
     * @param policyId Unique identifier for the policy
     * @param name Human-readable policy name
     * @param description Policy description
     * @param rulesHash IPFS hash containing policy rules
     */
    function createPolicy(
        bytes32 policyId,
        string memory name,
        string memory description,
        bytes32 rulesHash
    ) external {
        require(policies[policyId].id == 0, "Policy already exists");
        require(bytes(name).length > 0, "Policy name required");
        require(rulesHash != 0, "Rules hash required");

        policies[policyId] = Policy({
            id: policyId,
            name: name,
            description: description,
            rulesHash: rulesHash,
            creator: msg.sender,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            status: PolicyStatus.Draft
        });

        policyIds.push(policyId);
        totalPolicies++;

        emit PolicyCreated(policyId, name, msg.sender);
    }

    /**
     * @dev Update policy status
     * @param policyId Policy to update
     * @param status New status
     */
    function updatePolicyStatus(bytes32 policyId, PolicyStatus status) external {
        require(policies[policyId].id != 0, "Policy does not exist");
        require(
            policies[policyId].creator == msg.sender || msg.sender == owner,
            "Not authorized to update policy"
        );

        policies[policyId].status = status;
        policies[policyId].updatedAt = block.timestamp;

        emit PolicyUpdated(policyId, status);
    }

    /**
     * @dev Register a new AI agent
     * @param agentId Unique identifier for the agent
     * @param name Human-readable agent name
     * @param capabilities Array of agent capabilities
     * @param policyId Initial policy to assign to agent
     */
    function registerAgent(
        bytes32 agentId,
        string memory name,
        string[] memory capabilities,
        bytes32 policyId
    ) external {
        require(agents[agentId].id == 0, "Agent already registered");
        require(bytes(name).length > 0, "Agent name required");
        require(policies[policyId].status == PolicyStatus.Active, "Policy must be active");

        agents[agentId] = Agent({
            id: agentId,
            name: name,
            owner: msg.sender,
            capabilities: capabilities,
            registeredAt: block.timestamp,
            status: AgentStatus.Registered,
            currentPolicyId: policyId
        });

        agentIds.push(agentId);
        totalAgents++;

        emit AgentRegistered(agentId, name, msg.sender);
    }

    /**
     * @dev Update agent status
     * @param agentId Agent to update
     * @param status New status
     */
    function updateAgentStatus(bytes32 agentId, AgentStatus status)
        external
        onlyAgentOwner(agentId)
    {
        require(agents[agentId].id != 0, "Agent does not exist");

        agents[agentId].status = status;

        emit AgentStatusChanged(agentId, status);
    }

    /**
     * @dev Evaluate an agent action against governance policies
     * @param actionId Unique identifier for the action
     * @param agentId Agent performing the action
     * @param actionType Type of action being performed
     * @param dataHash IPFS hash of action data
     * @param approved Whether the action is approved
     */
    function evaluateAction(
        bytes32 actionId,
        bytes32 agentId,
        string memory actionType,
        bytes32 dataHash,
        bool approved
    ) external onlyAuthorizedEvaluator {
        require(actions[actionId].id == 0, "Action already evaluated");
        require(agents[agentId].id != 0, "Agent does not exist");
        require(agents[agentId].status == AgentStatus.Active, "Agent not active");

        bytes32 policyId = agents[agentId].currentPolicyId;
        require(policies[policyId].status == PolicyStatus.Active, "Policy not active");

        actions[actionId] = GovernanceAction({
            id: actionId,
            agentId: agentId,
            policyId: policyId,
            actionType: actionType,
            dataHash: dataHash,
            approved: approved,
            timestamp: block.timestamp,
            evaluator: msg.sender
        });

        actionIds.push(actionId);
        totalActions++;

        emit ActionEvaluated(actionId, agentId, approved);
    }

    /**
     * @dev Authorize an address to evaluate actions
     * @param evaluator Address to authorize
     */
    function authorizeEvaluator(address evaluator) external onlyOwner {
        authorizedEvaluators[evaluator] = true;
        emit EvaluatorAuthorized(evaluator);
    }

    /**
     * @dev Revoke evaluator authorization
     * @param evaluator Address to revoke
     */
    function revokeEvaluator(address evaluator) external onlyOwner {
        authorizedEvaluators[evaluator] = false;
        emit EvaluatorRevoked(evaluator);
    }

    /**
     * @dev Get policy details
     * @param policyId Policy identifier
     * @return Policy struct
     */
    function getPolicy(bytes32 policyId) external view returns (Policy memory) {
        require(policies[policyId].id != 0, "Policy does not exist");
        return policies[policyId];
    }

    /**
     * @dev Get agent details
     * @param agentId Agent identifier
     * @return Agent struct
     */
    function getAgent(bytes32 agentId) external view returns (Agent memory) {
        require(agents[agentId].id != 0, "Agent does not exist");
        return agents[agentId];
    }

    /**
     * @dev Get action details
     * @param actionId Action identifier
     * @return GovernanceAction struct
     */
    function getAction(bytes32 actionId) external view returns (GovernanceAction memory) {
        require(actions[actionId].id != 0, "Action does not exist");
        return actions[actionId];
    }

    /**
     * @dev Get all policy IDs
     * @return Array of policy IDs
     */
    function getAllPolicyIds() external view returns (bytes32[] memory) {
        return policyIds;
    }

    /**
     * @dev Get all agent IDs
     * @return Array of agent IDs
     */
    function getAllAgentIds() external view returns (bytes32[] memory) {
        return agentIds;
    }

    /**
     * @dev Get all action IDs
     * @return Array of action IDs
     */
    function getAllActionIds() external view returns (bytes32[] memory) {
        return actionIds;
    }

    /**
     * @dev Get governance statistics
     * @return totalPolicies, totalAgents, totalActions
     */
    function getStats() external view returns (uint256, uint256, uint256) {
        return (totalPolicies, totalAgents, totalActions);
    }
}
