// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SimpleGovernance
 * @dev Simplified governance contract for immediate deployment
 */
contract SimpleGovernance {
    struct Policy {
        bytes32 id;
        string name;
        string description;
        address creator;
        uint256 createdAt;
        bool active;
    }

    struct Agent {
        bytes32 id;
        string name;
        address owner;
        uint256 registeredAt;
        bool active;
        bytes32 policyId;
    }

    mapping(bytes32 => Policy) public policies;
    mapping(bytes32 => Agent) public agents;
    
    uint256 public totalPolicies;
    uint256 public totalAgents;
    uint256 public totalActions;

    event PolicyCreated(bytes32 indexed policyId, string name, address creator);
    event AgentRegistered(bytes32 indexed agentId, string name, address owner);
    event ActionEvaluated(bytes32 indexed actionId, bytes32 agentId, bool approved);

    function createPolicy(
        bytes32 policyId,
        string memory name,
        string memory description
    ) external {
        require(policies[policyId].creator == address(0), "Policy already exists");
        
        policies[policyId] = Policy({
            id: policyId,
            name: name,
            description: description,
            creator: msg.sender,
            createdAt: block.timestamp,
            active: true
        });
        
        totalPolicies++;
        emit PolicyCreated(policyId, name, msg.sender);
    }

    function registerAgent(
        bytes32 agentId,
        string memory name,
        bytes32 policyId
    ) external {
        require(agents[agentId].owner == address(0), "Agent already exists");
        require(policies[policyId].active, "Policy not active");
        
        agents[agentId] = Agent({
            id: agentId,
            name: name,
            owner: msg.sender,
            registeredAt: block.timestamp,
            active: true,
            policyId: policyId
        });
        
        totalAgents++;
        emit AgentRegistered(agentId, name, msg.sender);
    }

    function evaluateAction(
        bytes32 actionId,
        bytes32 agentId,
        bool approved
    ) external {
        require(agents[agentId].active, "Agent not active");
        require(agents[agentId].owner == msg.sender, "Not agent owner");
        
        totalActions++;
        emit ActionEvaluated(actionId, agentId, approved);
    }

    function getStats() external view returns (uint256, uint256, uint256) {
        return (totalPolicies, totalAgents, totalActions);
    }

    function getPolicy(bytes32 policyId) external view returns (Policy memory) {
        return policies[policyId];
    }

    function getAgent(bytes32 agentId) external view returns (Agent memory) {
        return agents[agentId];
    }
}