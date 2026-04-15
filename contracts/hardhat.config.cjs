const path = require("path");
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env.local") });
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const root = path.resolve(__dirname, "..");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.19",
  networks: {
    calibration: {
      url:
        process.env.FILECOIN_RPC_URL ||
        "https://api.calibration.node.glif.io/rpc/v1",
      accounts: process.env.FILECOIN_PRIVATE_KEY
        ? [process.env.FILECOIN_PRIVATE_KEY]
        : [],
      chainId: 314159,
    },
    xlayer: {
      url:
        process.env.XLAYER_RPC_URL || "https://rpc.xlayer.tech",
      accounts: process.env.XLAYER_PRIVATE_KEY
        ? [process.env.XLAYER_PRIVATE_KEY]
        : [],
      chainId: 196,
    },
    xlayerTestnet: {
      url:
        process.env.XLAYER_TESTNET_RPC_URL || "https://testrpc.xlayer.tech",
      accounts: process.env.XLAYER_PRIVATE_KEY
        ? [process.env.XLAYER_PRIVATE_KEY]
        : [],
      chainId: 1952,
    },
  },
  paths: {
    sources: path.join(root, "contracts", "src"),
    tests: path.join(root, "test"),
    cache: path.join(root, "build", "cache"),
    artifacts: path.join(root, "build", "artifacts"),
  },
};
