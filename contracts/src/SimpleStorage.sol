// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SimpleStorage
 * @dev Simplified storage contract for immediate deployment
 */
contract SimpleStorage {
    struct StorageRequest {
        bytes32 id;
        address requester;
        bytes32 dataHash; // IPFS/Filecoin CID
        uint256 size;
        uint256 duration; // Storage duration in blocks
        uint256 price; // Price in wei
        StorageStatus status;
        uint256 createdAt;
        uint256 expiresAt;
    }

    enum StorageStatus {
        Pending,
        Active,
        Completed,
        Failed,
        Expired
    }

    mapping(bytes32 => StorageRequest) public storageRequests;
    mapping(address => bytes32[]) public userRequests;
    
    uint256 public totalRequests;
    uint256 public activeRequests;
    uint256 public completedRequests;

    event StorageRequested(bytes32 indexed requestId, address indexed requester, bytes32 dataHash, uint256 size);
    event StorageConfirmed(bytes32 indexed requestId, address indexed provider);
    event StorageCompleted(bytes32 indexed requestId);

    function requestStorage(
        bytes32 requestId,
        bytes32 dataHash,
        uint256 size,
        uint256 duration
    ) external payable {
        require(storageRequests[requestId].requester == address(0), "Request already exists");
        require(msg.value > 0, "Payment required");
        require(size > 0, "Size must be greater than 0");
        require(duration > 0, "Duration must be greater than 0");

        storageRequests[requestId] = StorageRequest({
            id: requestId,
            requester: msg.sender,
            dataHash: dataHash,
            size: size,
            duration: duration,
            price: msg.value,
            status: StorageStatus.Pending,
            createdAt: block.timestamp,
            expiresAt: block.timestamp + duration
        });

        userRequests[msg.sender].push(requestId);
        totalRequests++;
        activeRequests++;

        emit StorageRequested(requestId, msg.sender, dataHash, size);
    }

    function confirmStorage(bytes32 requestId) external {
        StorageRequest storage request = storageRequests[requestId];
        require(request.requester != address(0), "Request does not exist");
        require(request.status == StorageStatus.Pending, "Request not pending");
        require(block.timestamp <= request.expiresAt, "Request expired");

        request.status = StorageStatus.Active;
        emit StorageConfirmed(requestId, msg.sender);
    }

    function completeStorage(bytes32 requestId) external {
        StorageRequest storage request = storageRequests[requestId];
        require(request.requester != address(0), "Request does not exist");
        require(request.status == StorageStatus.Active, "Request not active");

        request.status = StorageStatus.Completed;
        activeRequests--;
        completedRequests++;

        // Transfer payment (simplified - in production would have more complex logic)
        payable(msg.sender).transfer(request.price);

        emit StorageCompleted(requestId);
    }

    function getStorageRequest(bytes32 requestId) external view returns (StorageRequest memory) {
        return storageRequests[requestId];
    }

    function getUserRequests(address user) external view returns (bytes32[] memory) {
        return userRequests[user];
    }

    function getStats() external view returns (uint256, uint256, uint256) {
        return (totalRequests, activeRequests, completedRequests);
    }

    // Emergency functions
    function expireRequest(bytes32 requestId) external {
        StorageRequest storage request = storageRequests[requestId];
        require(request.requester != address(0), "Request does not exist");
        require(block.timestamp > request.expiresAt, "Request not expired");
        require(request.status == StorageStatus.Pending || request.status == StorageStatus.Active, "Invalid status");

        request.status = StorageStatus.Expired;
        if (request.status == StorageStatus.Active) {
            activeRequests--;
        }

        // Refund the requester
        payable(request.requester).transfer(request.price);
    }
}