// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AI Governance Storage Contract
 * @dev Smart contract for storing AI agent governance data on Filecoin Virtual Machine (FVM)
 * @notice This contract provides immutable storage for AI agent decisions, policy checks, and audit trails
 */
contract AIGovernanceStorage {

    // Events
    event GovernanceActionStored(
        bytes32 indexed actionId,
        address indexed agentAddress,
        string actionType,
        bool approved,
        uint256 timestamp
    );

    event PolicyViolationRecorded(
        bytes32 indexed actionId,
        address indexed agentAddress,
        string violationType,
        string reason,
        uint256 timestamp
    );

    event AgentRegistered(
        address indexed agentAddress,
        string agentName,
        string agentType,
        uint256 timestamp
    );

    // Structs
    struct GovernanceRecord {
        bytes32 actionId;
        address agentAddress;
        string actionType;
        string description;
        bool approved;
        uint256 policyCheckCount;
        string policyResult;
        uint256 timestamp;
        string filecoinCID; // IPFS/Filecoin CID for detailed data
        bool isImmutable;
    }

    struct PolicyViolation {
        bytes32 actionId;
        address agentAddress;
        string violationType;
        string reason;
        uint256 severity; // 1-5 scale
        uint256 timestamp;
        bool resolved;
    }

    struct AgentInfo {
        address agentAddress;
        string name;
        string agentType;
        uint256 totalActions;
        uint256 approvedActions;
        uint256 violations;
        uint256 registrationTime;
        bool active;
    }

    // State variables
    mapping(bytes32 => GovernanceRecord) public governanceRecords;
    mapping(bytes32 => PolicyViolation) public policyViolations;
    mapping(address => AgentInfo) public agents;
    mapping(address => bytes32[]) public agentActions;
    mapping(address => bytes32[]) public agentViolations;

    bytes32[] public allActionIds;
    bytes32[] public allViolationIds;
    address[] public registeredAgents;

    address public owner;
    uint256 public totalActions;
    uint256 public totalViolations;

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier validAgent(address agentAddress) {
        require(agentAddress != address(0), "Invalid agent address");
        require(agents[agentAddress].registrationTime > 0, "Agent not registered");
        _;
    }

    constructor() {
        owner = msg.sender;
        totalActions = 0;
        totalViolations = 0;
    }

    /**
     * @dev Register a new AI agent
     * @param agentAddress The address of the agent
     * @param name The name of the agent
     * @param agentType The type of agent (e.g., "trading", "healthcare")
     */
    function registerAgent(
        address agentAddress,
        string memory name,
        string memory agentType
    ) external onlyOwner {
        require(agentAddress != address(0), "Invalid agent address");
        require(agents[agentAddress].registrationTime == 0, "Agent already registered");

        agents[agentAddress] = AgentInfo({
            agentAddress: agentAddress,
            name: name,
            agentType: agentType,
            totalActions: 0,
            approvedActions: 0,
            violations: 0,
            registrationTime: block.timestamp,
            active: true
        });

        registeredAgents.push(agentAddress);

        emit AgentRegistered(agentAddress, name, agentType, block.timestamp);
    }

    /**
     * @dev Store a governance action record
     * @param actionId Unique identifier for the action
     * @param agentAddress Address of the agent that performed the action
     * @param actionType Type of action (e.g., "trading-decision", "data-access")
     * @param description Human-readable description of the action
     * @param approved Whether the action was approved by governance policies
     * @param policyCheckCount Number of policy checks performed
     * @param policyResult JSON string of policy check results
     * @param filecoinCID IPFS/Filecoin CID for detailed action data
     */
    function storeGovernanceAction(
        bytes32 actionId,
        address agentAddress,
        string memory actionType,
        string memory description,
        bool approved,
        uint256 policyCheckCount,
        string memory policyResult,
        string memory filecoinCID
    ) external validAgent(agentAddress) {
        require(governanceRecords[actionId].timestamp == 0, "Action already recorded");

        governanceRecords[actionId] = GovernanceRecord({
            actionId: actionId,
            agentAddress: agentAddress,
            actionType: actionType,
            description: description,
            approved: approved,
            policyCheckCount: policyCheckCount,
            policyResult: policyResult,
            timestamp: block.timestamp,
            filecoinCID: filecoinCID,
            isImmutable: true
        });

        // Update agent statistics
        agents[agentAddress].totalActions++;
        if (approved) {
            agents[agentAddress].approvedActions++;
        }

        // Track actions
        agentActions[agentAddress].push(actionId);
        allActionIds.push(actionId);
        totalActions++;

        emit GovernanceActionStored(
            actionId,
            agentAddress,
            actionType,
            approved,
            block.timestamp
        );
    }

    /**
     * @dev Record a policy violation
     * @param violationId Unique identifier for the violation
     * @param actionId The action that caused the violation
     * @param agentAddress Address of the agent that violated policy
     * @param violationType Type of violation
     * @param reason Reason for the violation
     * @param severity Severity level (1-5)
     */
    function recordPolicyViolation(
        bytes32 violationId,
        bytes32 actionId,
        address agentAddress,
        string memory violationType,
        string memory reason,
        uint256 severity
    ) external validAgent(agentAddress) {
        require(severity >= 1 && severity <= 5, "Severity must be between 1 and 5");
        require(policyViolations[violationId].timestamp == 0, "Violation already recorded");

        policyViolations[violationId] = PolicyViolation({
            actionId: actionId,
            agentAddress: agentAddress,
            violationType: violationType,
            reason: reason,
            severity: severity,
            timestamp: block.timestamp,
            resolved: false
        });

        // Update agent statistics
        agents[agentAddress].violations++;

        // Track violations
        agentViolations[agentAddress].push(violationId);
        allViolationIds.push(violationId);
        totalViolations++;

        emit PolicyViolationRecorded(
            actionId,
            agentAddress,
            violationType,
            reason,
            block.timestamp
        );
    }

    /**
     * @dev Get governance record by action ID
     */
    function getGovernanceRecord(bytes32 actionId)
        external
        view
        returns (GovernanceRecord memory)
    {
        return governanceRecords[actionId];
    }

    /**
     * @dev Get policy violation by violation ID
     */
    function getPolicyViolation(bytes32 violationId)
        external
        view
        returns (PolicyViolation memory)
    {
        return policyViolations[violationId];
    }

    /**
     * @dev Get agent information
     */
    function getAgentInfo(address agentAddress)
        external
        view
        returns (AgentInfo memory)
    {
        return agents[agentAddress];
    }

    /**
     * @dev Get all actions for an agent
     */
    function getAgentActions(address agentAddress)
        external
        view
        returns (bytes32[] memory)
    {
        return agentActions[agentAddress];
    }

    /**
     * @dev Get all violations for an agent
     */
    function getAgentViolations(address agentAddress)
        external
        view
        returns (bytes32[] memory)
    {
        return agentViolations[agentAddress];
    }

    /**
     * @dev Get total number of registered agents
     */
    function getTotalAgents() external view returns (uint256) {
        return registeredAgents.length;
    }

    /**
     * @dev Get governance statistics
     */
    function getGovernanceStats()
        external
        view
        returns (
            uint256 _totalActions,
            uint256 _totalViolations,
            uint256 _totalAgents,
            uint256 _approvalRate
        )
    {
        _totalActions = totalActions;
        _totalViolations = totalViolations;
        _totalAgents = registeredAgents.length;

        // Calculate approval rate
        uint256 totalApproved = 0;
        for (uint256 i = 0; i < registeredAgents.length; i++) {
            totalApproved += agents[registeredAgents[i]].approvedActions;
        }

        _approvalRate = totalActions > 0 ? (totalApproved * 100) / totalActions : 100;
    }

    /**
     * @dev Resolve a policy violation (only owner)
     */
    function resolvePolicyViolation(bytes32 violationId) external onlyOwner {
        require(policyViolations[violationId].timestamp > 0, "Violation not found");
        require(!policyViolations[violationId].resolved, "Violation already resolved");

        policyViolations[violationId].resolved = true;
    }

    /**
     * @dev Deactivate an agent (only owner)
     */
    function deactivateAgent(address agentAddress) external onlyOwner validAgent(agentAddress) {
        agents[agentAddress].active = false;
    }

    /**
     * @dev Reactivate an agent (only owner)
     */
    function reactivateAgent(address agentAddress) external onlyOwner validAgent(agentAddress) {
        agents[agentAddress].active = true;
    }
}
