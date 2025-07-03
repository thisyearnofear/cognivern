// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {CBOR} from "solidity-cborutils/contracts/CBOR.sol";

/**
 * @title StorageContract
 * @dev Programmable storage contract for governance data on Filecoin
 */
contract StorageContract {
    using CBOR for CBOR.CBORBuffer;

    struct StorageRequest {
        bytes32 id;
        address requester;
        bytes32 dataHash; // IPFS/Filecoin CID
        uint256 size;
        uint256 duration; // Storage duration in blocks
        uint256 price; // Price in USDFC
        StorageStatus status;
        uint256 createdAt;
        uint256 expiresAt;
        address provider;
    }

    struct RetrievalRequest {
        bytes32 id;
        address requester;
        bytes32 dataHash;
        uint256 price; // Price in USDFC
        RetrievalStatus status;
        uint256 createdAt;
        address provider;
    }

    struct StorageProvider {
        address provider;
        string endpoint;
        uint256 pricePerGB; // Price per GB in USDFC
        uint256 reputation;
        bool active;
        uint256 registeredAt;
    }

    enum StorageStatus { Pending, Stored, Failed, Expired }
    enum RetrievalStatus { Pending, Retrieved, Failed }

    // State variables
    mapping(bytes32 => StorageRequest) public storageRequests;
    mapping(bytes32 => RetrievalRequest) public retrievalRequests;
    mapping(address => StorageProvider) public providers;
    mapping(bytes32 => address[]) public dataProviders; // Data hash to providers
    mapping(address => bytes32[]) public userStorageRequests;
    mapping(address => bytes32[]) public userRetrievalRequests;

    address[] public providerAddresses;
    bytes32[] public storageRequestIds;
    bytes32[] public retrievalRequestIds;

    address public owner;
    address public usdcToken; // USDFC token contract
    uint256 public totalStorageRequests;
    uint256 public totalRetrievalRequests;
    uint256 public totalProviders;

    // Events
    event StorageRequested(bytes32 indexed requestId, address requester, bytes32 dataHash, uint256 price);
    event StorageCompleted(bytes32 indexed requestId, address provider);
    event StorageFailed(bytes32 indexed requestId, string reason);
    event RetrievalRequested(bytes32 indexed requestId, address requester, bytes32 dataHash);
    event RetrievalCompleted(bytes32 indexed requestId, address provider);
    event ProviderRegistered(address indexed provider, string endpoint);
    event ProviderUpdated(address indexed provider, bool active);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier onlyProvider() {
        require(providers[msg.sender].provider != address(0), "Not a registered provider");
        _;
    }

    constructor(address _usdcToken) {
        owner = msg.sender;
        usdcToken = _usdcToken;
    }

    /**
     * @dev Register as a storage provider
     * @param endpoint Provider's storage endpoint
     * @param pricePerGB Price per GB in USDFC
     */
    function registerProvider(string memory endpoint, uint256 pricePerGB) external {
        require(providers[msg.sender].provider == address(0), "Provider already registered");
        require(bytes(endpoint).length > 0, "Endpoint required");
        require(pricePerGB > 0, "Price must be greater than 0");

        providers[msg.sender] = StorageProvider({
            provider: msg.sender,
            endpoint: endpoint,
            pricePerGB: pricePerGB,
            reputation: 100, // Start with neutral reputation
            active: true,
            registeredAt: block.timestamp
        });

        providerAddresses.push(msg.sender);
        totalProviders++;

        emit ProviderRegistered(msg.sender, endpoint);
    }

    /**
     * @dev Update provider status
     * @param active Whether provider is active
     */
    function updateProviderStatus(bool active) external onlyProvider {
        providers[msg.sender].active = active;
        emit ProviderUpdated(msg.sender, active);
    }

    /**
     * @dev Request storage for governance data
     * @param requestId Unique request identifier
     * @param dataHash IPFS/Filecoin CID of data to store
     * @param size Data size in bytes
     * @param duration Storage duration in blocks
     */
    function requestStorage(
        bytes32 requestId,
        bytes32 dataHash,
        uint256 size,
        uint256 duration
    ) external payable {
        require(storageRequests[requestId].id == 0, "Request already exists");
        require(dataHash != 0, "Data hash required");
        require(size > 0, "Size must be greater than 0");
        require(duration > 0, "Duration must be greater than 0");

        // Calculate storage price (simplified pricing model)
        uint256 sizeInGB = (size + 1e9 - 1) / 1e9; // Round up to nearest GB
        uint256 basePrice = sizeInGB * 1e6; // Base price in USDFC (1 USDFC per GB)
        uint256 durationMultiplier = duration / 2880; // Assuming ~2880 blocks per day
        uint256 totalPrice = basePrice * (durationMultiplier + 1);

        require(msg.value >= totalPrice, "Insufficient payment");

        storageRequests[requestId] = StorageRequest({
            id: requestId,
            requester: msg.sender,
            dataHash: dataHash,
            size: size,
            duration: duration,
            price: totalPrice,
            status: StorageStatus.Pending,
            createdAt: block.timestamp,
            expiresAt: block.timestamp + (duration * 12), // Assuming 12 second blocks
            provider: address(0)
        });

        storageRequestIds.push(requestId);
        userStorageRequests[msg.sender].push(requestId);
        totalStorageRequests++;

        emit StorageRequested(requestId, msg.sender, dataHash, totalPrice);
    }

    /**
     * @dev Provider confirms storage completion
     * @param requestId Storage request to confirm
     */
    function confirmStorage(bytes32 requestId) external onlyProvider {
        require(storageRequests[requestId].id != 0, "Request does not exist");
        require(storageRequests[requestId].status == StorageStatus.Pending, "Request not pending");
        require(providers[msg.sender].active, "Provider not active");

        storageRequests[requestId].status = StorageStatus.Stored;
        storageRequests[requestId].provider = msg.sender;

        // Add provider to data providers list
        dataProviders[storageRequests[requestId].dataHash].push(msg.sender);

        // Transfer payment to provider (simplified)
        payable(msg.sender).transfer(storageRequests[requestId].price);

        emit StorageCompleted(requestId, msg.sender);
    }

    /**
     * @dev Mark storage as failed
     * @param requestId Storage request that failed
     * @param reason Failure reason
     */
    function markStorageFailed(bytes32 requestId, string memory reason) external onlyProvider {
        require(storageRequests[requestId].id != 0, "Request does not exist");
        require(storageRequests[requestId].status == StorageStatus.Pending, "Request not pending");

        storageRequests[requestId].status = StorageStatus.Failed;

        // Refund payment to requester
        payable(storageRequests[requestId].requester).transfer(storageRequests[requestId].price);

        emit StorageFailed(requestId, reason);
    }

    /**
     * @dev Request data retrieval
     * @param requestId Unique request identifier
     * @param dataHash IPFS/Filecoin CID of data to retrieve
     */
    function requestRetrieval(bytes32 requestId, bytes32 dataHash) external payable {
        require(retrievalRequests[requestId].id == 0, "Request already exists");
        require(dataHash != 0, "Data hash required");
        require(dataProviders[dataHash].length > 0, "Data not available");

        uint256 retrievalPrice = 1e5; // 0.1 USDFC for retrieval
        require(msg.value >= retrievalPrice, "Insufficient payment");

        retrievalRequests[requestId] = RetrievalRequest({
            id: requestId,
            requester: msg.sender,
            dataHash: dataHash,
            price: retrievalPrice,
            status: RetrievalStatus.Pending,
            createdAt: block.timestamp,
            provider: address(0)
        });

        retrievalRequestIds.push(requestId);
        userRetrievalRequests[msg.sender].push(requestId);
        totalRetrievalRequests++;

        emit RetrievalRequested(requestId, msg.sender, dataHash);
    }

    /**
     * @dev Provider confirms retrieval completion
     * @param requestId Retrieval request to confirm
     */
    function confirmRetrieval(bytes32 requestId) external onlyProvider {
        require(retrievalRequests[requestId].id != 0, "Request does not exist");
        require(retrievalRequests[requestId].status == RetrievalStatus.Pending, "Request not pending");
        require(providers[msg.sender].active, "Provider not active");

        // Verify provider has the data
        bytes32 dataHash = retrievalRequests[requestId].dataHash;
        bool hasData = false;
        for (uint i = 0; i < dataProviders[dataHash].length; i++) {
            if (dataProviders[dataHash][i] == msg.sender) {
                hasData = true;
                break;
            }
        }
        require(hasData, "Provider does not have this data");

        retrievalRequests[requestId].status = RetrievalStatus.Retrieved;
        retrievalRequests[requestId].provider = msg.sender;

        // Transfer payment to provider
        payable(msg.sender).transfer(retrievalRequests[requestId].price);

        emit RetrievalCompleted(requestId, msg.sender);
    }

    /**
     * @dev Get storage request details
     * @param requestId Request identifier
     * @return StorageRequest struct
     */
    function getStorageRequest(bytes32 requestId) external view returns (StorageRequest memory) {
        require(storageRequests[requestId].id != 0, "Request does not exist");
        return storageRequests[requestId];
    }

    /**
     * @dev Get retrieval request details
     * @param requestId Request identifier
     * @return RetrievalRequest struct
     */
    function getRetrievalRequest(bytes32 requestId) external view returns (RetrievalRequest memory) {
        require(retrievalRequests[requestId].id != 0, "Request does not exist");
        return retrievalRequests[requestId];
    }

    /**
     * @dev Get provider details
     * @param provider Provider address
     * @return StorageProvider struct
     */
    function getProvider(address provider) external view returns (StorageProvider memory) {
        require(providers[provider].provider != address(0), "Provider does not exist");
        return providers[provider];
    }

    /**
     * @dev Get providers for specific data
     * @param dataHash Data hash
     * @return Array of provider addresses
     */
    function getDataProviders(bytes32 dataHash) external view returns (address[] memory) {
        return dataProviders[dataHash];
    }

    /**
     * @dev Get user's storage requests
     * @param user User address
     * @return Array of storage request IDs
     */
    function getUserStorageRequests(address user) external view returns (bytes32[] memory) {
        return userStorageRequests[user];
    }

    /**
     * @dev Get user's retrieval requests
     * @param user User address
     * @return Array of retrieval request IDs
     */
    function getUserRetrievalRequests(address user) external view returns (bytes32[] memory) {
        return userRetrievalRequests[user];
    }

    /**
     * @dev Get all active providers
     * @return Array of active provider addresses
     */
    function getActiveProviders() external view returns (address[] memory) {
        uint256 activeCount = 0;
        for (uint i = 0; i < providerAddresses.length; i++) {
            if (providers[providerAddresses[i]].active) {
                activeCount++;
            }
        }

        address[] memory activeProviders = new address[](activeCount);
        uint256 index = 0;
        for (uint i = 0; i < providerAddresses.length; i++) {
            if (providers[providerAddresses[i]].active) {
                activeProviders[index] = providerAddresses[i];
                index++;
            }
        }

        return activeProviders;
    }

    /**
     * @dev Get storage statistics
     * @return totalStorageRequests, totalRetrievalRequests, totalProviders
     */
    function getStats() external view returns (uint256, uint256, uint256) {
        return (totalStorageRequests, totalRetrievalRequests, totalProviders);
    }
}