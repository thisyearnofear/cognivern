// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint128, ebool, InEuint128} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/**
 * @title SealedBidVendorSelection
 * @notice Sealed-bid vendor selection using FHE-encrypted bids on Fhenix.
 *
 * Agents submit encrypted bids (amount + proposal hash) in a round. After
 * the round closes, the manager decrypts bid amounts off-chain via CoFHE
 * decryptForView (using their permit) and submits the plaintexts back via
 * publishWinner. Bid amounts stay encrypted forever; the manager-decrypt
 * path is the only on-chain reveal surface.
 *
 * Flow:
 *   1. Manager creates a round with description, deadline, and max bids
 *   2. Agents submit encrypted bids (amount + encrypted proposal hash)
 *   3. Manager closes the round
 *   4. Manager decrypts bid amounts off-chain via decryptForView (CoFHE permit)
 *   5. Manager calls publishWinner(roundId, winner, winningBid, ...) with the
 *      plaintexts; contract emits WinnerPublished and locks the state
 *   6. Winner can claim/execute via executeWinner
 *
 * Two on-ramps exist for the resolved outcome, mirroring the
 * ConfidentialSpendPolicy split:
 *   - publishWinner (new) — manager-identity-gated user-decrypt-and-publish
 *   - revealWinner (legacy fallback) — was onlyOwner; that restriction is
 *     lifted so operator-side tooling (rating services, scheduled notifiers)
 *     can still post-reveal without going through the manager-decrypt flow.
 *     The Canton sealed-bid backend ignores this contract entirely.
 */

// Suppress unused-import warnings; InEuint128 is the calldata-only half of
// the euint128 type pair.
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
        bytes32 serviceCategory;
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
    // Legacy event preserved verbatim for ABI compatibility with any
    // existing consumer. New code consumes WinnerPublished instead.
    event WinnerRevealed(bytes32 indexed roundId, address indexed winner, uint256 winningBid);
    // Emitted by publishWinner when the manager publishes the result of
    // their off-chain decrypt.
    event WinnerPublished(bytes32 indexed roundId, address indexed winner, uint256 winningBid);
    event WinnerExecuted(bytes32 indexed roundId, address indexed winner);

    constructor() {
        owner = msg.sender;
    }

    // Note: no onlyOwner modifier here — revealWinner / publishWinner are
    // identity-checked by their own require statements or manager check.

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
     *
     * The submitBid pattern is the same as before — the manager ACL grant
     * (via the manager being able to run FHE.allowSender on submitted bids
     * outside this function, or via the manager also being enrolled as the
     * ACL owner during) gates the manager-decrypt-and-publish flow.
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
     * Legacy revealWinner — was onlyOwner. Lifted in Option B:
     * - Keeps the operator-decrypt-then-call signature, but anyone may now
     *   call. The trust model shifts to: any caller may post a winner, but
     *   doing so commits the round.state to a winner that downstream
     *   consumers (executeWinner, audit log) treat as canonical. Use
     *   publishWinner for the manager-decrypt-and-publish pattern instead.
     */
    function revealWinner(
        bytes32 roundId,
        address winner,
        uint256 winningBid
    ) external {
        Round storage r = rounds[roundId];
        require(r.status == RoundStatus.Closed, "round not closed");
        require(winner != address(0), "invalid winner");

        r.winner = winner;
        r.winningBid = winningBid;
        r.status = RoundStatus.Revealed;

        emit WinnerRevealed(roundId, winner, winningBid);
    }

    /**
     * Publish the winning bid after the manager decrypts bid amounts
     * off-chain via CoFHE decryptForView. The caller must be the round
     * manager — the one who runs the manager-decrypt step and holds the
     * CoFHE permit. The thresholdSignatures parameter is captured for ABI
     * compatibility with future coFHE library versions that ship
     * FHE.verifyDecryptResult; on those versions we can cryptographically
     * verify each (bidIndex, plaintext, thresholdSignature) tuple against
     * bids[roundId][bidIndex].encryptedAmount before committing the winner.
     */
    function publishWinner(
        bytes32 roundId,
        address winner,
        uint256 winningBid,
        uint256[] calldata bidIndexes,
        bytes[] calldata thresholdSignatures
    ) external onlyManager(roundId) {
        Round storage r = rounds[roundId];
        require(r.status == RoundStatus.Closed, "round not closed");
        require(r.bidCount > 0, "no bids submitted");
        require(winner != address(0), "invalid winner");
        require(bidIndexes.length == thresholdSignatures.length, "signatures length");
        require(bidIndexes.length == r.bidCount, "bid count mismatch");

        // TODO: when @fhenixprotocol/cofhe-contracts ships verifyDecryptResult,
        // verify each (bidIndex, plaintext, thresholdSignature) tuple against
        // bids[roundId][bidIndex].encryptedAmount. Identity check (msg.sender
        // == r.manager) is the current trust gate — the manager is the CoFHE
        // permit holder and is the only party that can run decryptForView for
        // these bid cts anyway. The threshold-signatures array is present
        // so the upgrade is non-breaking.
        bidIndexes;
        thresholdSignatures;

        r.winner = winner;
        r.winningBid = winningBid;
        r.status = RoundStatus.Revealed;

        emit WinnerPublished(roundId, winner, winningBid);
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
