// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title GovernedVault
 * @notice A DeFi vault that only executes transactions approved by a remote policy (Fhenix)
 * via Hyperlane messaging.
 */

interface IMessageRecipient {
    function handle(
        uint32 _origin,
        bytes32 _sender,
        bytes calldata _message
    ) external payable;
}

contract GovernedVault is IMessageRecipient {
    address public owner;
    address public mailbox;
    uint32 public fhenixDomain;
    bytes32 public fhenixSender;

    event CallExecuted(address indexed target, uint256 value, bytes data, bool success, bytes response);
    event FundsReceived(address sender, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Configure Hyperlane Bridge security
     */
    function setHyperlaneConfig(
        address _mailbox,
        uint32 _fhenixDomain,
        bytes32 _fhenixSender
    ) external {
        require(msg.sender == owner, "Only owner can configure");
        mailbox = _mailbox;
        fhenixDomain = _fhenixDomain;
        fhenixSender = _fhenixSender;
    }

    /**
     * @dev Hyperlane handle method - processes the cross-chain execution request
     */
    function handle(
        uint32 _origin,
        bytes32 _sender,
        bytes calldata _message
    ) external payable override {
        require(msg.sender == mailbox, "Only mailbox can call handle");
        require(_origin == fhenixDomain, "Origin domain not supported");
        require(_sender == fhenixSender, "Sender not authorized");

        // Decode the execution payload
        // payload: abi.encode(target, value, data)
        (address target, uint256 value, bytes memory data) = abi.decode(
            _message,
            (address, uint256, bytes)
        );

        // Security check: Don't allow the vault to call its own configuration methods
        require(target != address(this), "Cannot call self");

        // Execute the call
        (bool success, bytes memory response) = target.call{value: value}(data);

        emit CallExecuted(target, value, data, success, response);
        require(success, "Execution failed");
    }

    /**
     * @dev Allow the vault to receive native tokens
     */
    receive() external payable {
        emit FundsReceived(msg.sender, msg.value);
    }
}
