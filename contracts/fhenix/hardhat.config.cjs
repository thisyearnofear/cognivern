const path = require("path");
require("@nomicfoundation/hardhat-toolbox");
require("@cofhe/hardhat-plugin");
require("dotenv").config({
  path: path.resolve(__dirname, "..", "..", ".env.local"),
});
require("dotenv").config({
  path: path.resolve(__dirname, "..", "..", ".env"),
});

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun",
      viaIR: true,
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    // `arb-sepolia`, `eth-sepolia`, and `localcofhe` are auto-injected by
    // @cofhe/hardhat-plugin. We don't override them here.
    // For the deploy, we use the auto-injected `arb-sepolia` (chainId 421614).
    arbitrumSepolia: {
      url:
        process.env.ARBITRUM_SEPOLIA_RPC_URL ||
        process.env.ARB_SEPOLIA_RPC ||
        "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: process.env.ARBITRUM_PRIVATE_KEY
        ? [process.env.ARBITRUM_PRIVATE_KEY]
        : process.env.FHENIX_PRIVATE_KEY
          ? [process.env.FHENIX_PRIVATE_KEY]
          : process.env.FILECOIN_PRIVATE_KEY
            ? [process.env.FILECOIN_PRIVATE_KEY]
            : [],
      chainId: 421614,
    },
    baseSepolia: {
      url:
        process.env.BASE_SEPOLIA_RPC_URL ||
        process.env.BASE_SEPOLIA_RPC ||
        "https://sepolia.base.org",
      accounts: process.env.FHENIX_PRIVATE_KEY
        ? [process.env.FHENIX_PRIVATE_KEY]
        : process.env.FILECOIN_PRIVATE_KEY
          ? [process.env.FILECOIN_PRIVATE_KEY]
          : [],
      chainId: 84532,
    },
  },
  cofhe: {
    // Quiet output for production deploys
    logMocks: false,
    gasWarning: false,
    mocksDeployVerbosity: "v",
  },
  paths: {
    sources: path.join(__dirname, "src"),
    tests: path.join(__dirname, "test"),
    // Keep cache/artifacts inside the config's directory so the
    // coFHE plugin's stub files resolve as project-local (avoids HH1007).
    cache: path.join(__dirname, "build", "cache"),
    artifacts: path.join(__dirname, "build", "artifacts"),
  },
};
