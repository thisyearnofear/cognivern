// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint128, ebool, InEuint128} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/**
 * @title SealedBidVendorSelection
 * @notice Sealed-bid vendor selection using FHE-encrypted bids on Fhenix.
 *
 * Agents submit encrypted bids (amount + proposal hash) in a round.
 * After the round closes, the operator decrypts bids off-chain via CoFHE
 * threshold decryption and reveals the winner. All losing bids stay encrypted.
 *
 * Flow:
 *   1. Manager creates a round with description, deadline, and max bids
 *   2. Agents submit encrypted bids (amount + encrypted proposal hash)
 *   3. Manager closes the round
 *   4. Operator decrypts bids off-chain, calls revealWinner with the winner
 *   5. Winner can claim/execute the contract
 *
 * Uses the same two-phase pattern as ConfidentialSpendPolicy:
 *   submitBid → emits BidSubmitted(encrypted)
 *   revealWinner (off-chain FHE decrypt of bids, then call on-chain)
 */

contract SealedBidVendorSelection {
    enum BidStatus { Pending, Selected, Rejected }
    enum RoundStatus { Open, Closed, Revealed }

    struct Bid {
        address bidder;
        euint128 encryptedAmount;   // FHE-encrypted bid amount
        bytes32 proposalHash;       // Commitment to the full proposal
        BidStatus status;
        uint256 submittedAt;
    }

    struct Round {
        string description;
        address manager;
        bytes32 serviceCategory;    // e.g., keccak256("audit"), keccak256("devops")
        uint256 deadline;
        uint256 maxBids;
        RoundStatus status;
        uint256 bidCount;
        address winner;
        uint256 winningBid;         // Revealed winning amount (plaintext)
        uint256 createdAt;
    }

    // roundId => Round
    mapping(bytes32 => Round) public rounds;
    // roundId => bidIndex => Bid
    mapping(bytes32 => mapping(uint256 => Bid)) public bids;
    // roundId => bidder => whether they already bid
    mapping(bytes32 => mapping(address => bool)) public hasBid;

    address public owner;

    event RoundCreated(bytes32 indexed roundId, string description, uint256 deadline);
    event BidSubmitted(bytes32 indexed roundId, address indexed bidder, uint256 bidIndex);
    event RoundClosed(bytes32 indexed roundId, uint256 bidCount);
    event WinnerRevealed(bytes32 indexed roundId, address indexed winner, uint256 winningBid);
    event WinnerExecuted(bytes32 indexed roundId, address indexed winner);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyManager(bytes32 roundId) {
        require(msg.sender == rounds[roundId].manager, "not manager");
        _;
    }

    /**
     * Create a new sealed-bid round.
     */
    function createRound(
        bytes32 roundId,
        string calldata description,
        bytes32 serviceCategory,
        uint256 deadline,
        uint256 maxBids
    ) external {
        require(rounds[roundId].createdAt == 0, "round exists");
        require(deadline > block.timestamp, "deadline must be in future");
        require(maxBids > 0, "maxBids must be > 0");

        rounds[roundId] = Round({
            description: description,
            manager: msg.sender,
            serviceCategory: serviceCategory,
            deadline: deadline,
            maxBids: maxBids,
            status: RoundStatus.Open,
            bidCount: 0,
            winner: address(0),
            winningBid: 0,
            createdAt: block.timestamp
        });

        emit RoundCreated(roundId, description, deadline);
    }

    /**
     * Submit an encrypted bid for an open round.
     * The bid amount is FHE-encrypted (euint128) so no one sees it until reveal.
     * proposalHash serves as a commitment to the full proposal details.
     */
    function submitBid(
        bytes32 roundId,
        InEuint128 calldata amountCt,
        bytes32 proposalHash
    ) external {
        Round storage r = rounds[roundId];
        require(r.status == RoundStatus.Open, "round not open");
        require(block.timestamp < r.deadline, "past deadline");
        require(r.bidCount < r.maxBids, "max bids reached");
        require(!hasBid[roundId][msg.sender], "already bid");

        uint256 bidIndex = r.bidCount;

        bids[roundId][bidIndex] = Bid({
            bidder: msg.sender,
            encryptedAmount: FHE.asEuint128(amountCt),
            proposalHash: proposalHash,
            status: BidStatus.Pending,
            submittedAt: block.timestamp
        });

        hasBid[roundId][msg.sender] = true;
        r.bidCount = bidIndex + 1;

        emit BidSubmitted(roundId, msg.sender, bidIndex);
    }

    /**
     * Close the round to new bids.
     * Called by the manager after the deadline or when enough bids are in.
     */
    function closeRound(bytes32 roundId) external onlyManager(roundId) {
        Round storage r = rounds[roundId];
        require(r.status == RoundStatus.Open, "round not open");

        r.status = RoundStatus.Closed;
        emit RoundClosed(roundId, r.bidCount);
    }

    /**
     * Reveal the winning bid after off-chain threshold decryption.
     *
     * The operator decrypts all bids off-chain using a CoFHE permit,
     * determines the winner (e.g., lowest bid), then calls this function
     * to record the winner on-chain.
     *
     * This is the second phase: submitBid stores encrypted → operator
     * decrypts off-chain → revealWinner publishes the result.
     */
    function revealWinner(
        bytes32 roundId,
        address winner,
        uint256 winningBid
    ) external onlyOwner {
        Round storage r = rounds[roundId];
        require(r.status == RoundStatus.Closed, "round not closed");
        require(winner != address(0), "invalid winner");

        r.winner = winner;
        r.winningBid = winningBid;
        r.status = RoundStatus.Revealed;

        emit WinnerRevealed(roundId, winner, winningBid);
    }

    /**
     * Execute the winning bid.
     * Called by the winner to claim/execute the contract.
     */
    function executeWinner(bytes32 roundId) external {
        Round storage r = rounds[roundId];
        require(r.status == RoundStatus.Revealed, "round not revealed");
        require(msg.sender == r.winner, "not winner");
        require(r.winner != address(0), "no winner");

        emit WinnerExecuted(roundId, msg.sender);
    }

    /**
     * Get bid count for a round.
     */
    function getBidCount(bytes32 roundId) external view returns (uint256) {
        return rounds[roundId].bidCount;
    }

    /**
     * Get bidder address by round and index.
     */
    function getBidder(bytes32 roundId, uint256 index) external view returns (address) {
        require(index < rounds[roundId].bidCount, "invalid index");
        return bids[roundId][index].bidder;
    }

    /**
     * Get round status.
     */
    function getRoundStatus(bytes32 roundId) external view returns (RoundStatus) {
        return rounds[roundId].status;
    }
}
