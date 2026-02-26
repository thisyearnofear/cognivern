require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

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
    polkadotHub: {
      url: process.env.POLKADOT_RPC_URL || "https://polkadot-hub-rpc.url",
      accounts: process.env.POLKADOT_PRIVATE_KEY
        ? [process.env.POLKADOT_PRIVATE_KEY]
        : [],
      chainId: 100000, // Placeholder, will be updated with actual chainId for Polkadot Hub
    },
  },
  paths: {
    sources: "./contracts/src",
    tests: "./test",
    cache: "./build/cache",
    artifacts: "./build/artifacts",
  },
};
