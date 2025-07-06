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
  },
  paths: {
    sources: "./contracts/src",
    tests: "./test",
    cache: "./build/cache",
    artifacts: "./build/artifacts",
  },
};
