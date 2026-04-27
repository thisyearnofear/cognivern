const path = require("path");
require("@nomicfoundation/hardhat-toolbox");
// CoFHE Hardhat plugin enables local FHE development without testnet dependencies.
try {
  require("@fhenixprotocol/cofhe-hardhat-plugin");
  require("@fhenixprotocol/hardhat-fhenix");
} catch (_) {
  // Plugins are optional during initial scaffolding
}
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env.local") });
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });

const root = path.resolve(__dirname, "..", "..");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.25", // Match contract version
  networks: {
    fhenixSepolia: {
      url: process.env.FHENIX_SEPOLIA_RPC || "https://api.testnet.fhenix.zone",
      accounts: process.env.FHENIX_PRIVATE_KEY ? [process.env.FHENIX_PRIVATE_KEY] : [],
    },
    arbitrumSepolia: {
      url: process.env.ARB_SEPOLIA_RPC || "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: process.env.FHENIX_PRIVATE_KEY ? [process.env.FHENIX_PRIVATE_KEY] : [],
      chainId: 421614,
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org",
      accounts: process.env.FHENIX_PRIVATE_KEY ? [process.env.FHENIX_PRIVATE_KEY] : [],
      chainId: 84532,
    },
  },
  paths: {
    sources: path.join(__dirname, "src"),
    tests: path.join(__dirname, "test"),
    cache: path.join(root, "build", "fhenix-cache"),
    artifacts: path.join(root, "build", "fhenix-artifacts"),
  },
};
