// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { ITeeExtensionRegistry } from "../interfaces/ITeeExtensionRegistry.sol";

/// @dev Minimal mock of the FlareTeeManager diamond facets used by unit tests.
contract MockTeeRegistries {
    uint256 public nextPublicExtensionId = 0x10001; // one past FIRST_PUBLIC_EXTENSION_ID
    mapping(uint256 => address) public instructionSenders;
    bytes32 public lastInstructionId;
    bytes32 public lastOpType;
    bytes32 public lastOpCommand;
    bytes public lastMessage;
    uint256 public sendCount;

    function setInstructionSender(uint256 extensionId, address sender) external {
        instructionSenders[extensionId] = sender;
    }

    function bumpNextPublicExtensionId(uint256 nextId) external {
        nextPublicExtensionId = nextId;
    }

    function getTeeExtensionInstructionsSender(uint256 extensionId) external view returns (address) {
        return instructionSenders[extensionId];
    }

    function getRandomTeeIds(uint256, uint256 count) external pure returns (address[] memory ids) {
        ids = new address[](count);
        for (uint256 i = 0; i < count; ++i) {
            ids[i] = address(uint160(0xBEEF + i));
        }
    }

    function sendInstructions(
        address[] calldata,
        ITeeExtensionRegistry.TeeInstructionParams calldata params
    ) external payable returns (bytes32 instructionId) {
        sendCount += 1;
        lastOpType = params.opType;
        lastOpCommand = params.opCommand;
        lastMessage = params.message;
        instructionId = keccak256(abi.encode(sendCount, params.opType, params.opCommand, params.message));
        lastInstructionId = instructionId;
    }
}
