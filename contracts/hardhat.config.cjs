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
      url: process.env.XLAYER_RPC_URL || "https://rpc.xlayer.tech",
      accounts: process.env.XLAYER_PRIVATE_KEY
        ? [process.env.XLAYER_PRIVATE_KEY]
        : [],
      chainId: 196,
    },
    xlayerTestnet: {
      url: process.env.XLAYER_TESTNET_RPC_URL || "https://testrpc.xlayer.tech",
      accounts: process.env.XLAYER_PRIVATE_KEY
        ? [process.env.XLAYER_PRIVATE_KEY]
        : [],
      chainId: 195,
    },
    mantle: {
      url: process.env.MANTLE_RPC_URL || "https://rpc.mantle.xyz",
      accounts: process.env.MANTLE_PRIVATE_KEY
        ? [process.env.MANTLE_PRIVATE_KEY]
        : [],
      chainId: 5000,
    },
    mantleSepolia: {
      url:
        process.env.MANTLE_SEPOLIA_RPC_URL || "https://rpc.sepolia.mantle.xyz",
      accounts: process.env.MANTLE_PRIVATE_KEY
        ? [process.env.MANTLE_PRIVATE_KEY]
        : [],
      chainId: 5003,
    },
    arbitrumSepolia: {
      url:
        process.env.ARBITRUM_SEPOLIA_RPC_URL ||
        "https://sepolia-rollup.arbitrum.io/rpc",
      // Reuse the FHENIX_PRIVATE_KEY for Arbitrum Sepolia — the same deployer
      // wallet owns contracts on Filecoin, X Layer, Mantle, and Arbitrum Sepolia.
      accounts: process.env.ARBITRUM_PRIVATE_KEY
        ? [process.env.ARBITRUM_PRIVATE_KEY]
        : process.env.FHENIX_PRIVATE_KEY
          ? [process.env.FHENIX_PRIVATE_KEY]
          : [],
      chainId: 421614,
    },
    robinhoodChainTestnet: {
      // Robinhood Chain testnet (Arbitrum Orbit) — chainId 46630
      // Faucet: https://faucet.testnet.chain.robinhood.com
      // Explorer: https://explorer.testnet.chain.robinhood.com
      // Reserve 1 of 3 prizes in the Arbitrum Open House London buildathon.
      url:
        process.env.ROBINHOOD_CHAIN_TESTNET_RPC_URL ||
        "https://rpc.testnet.chain.robinhood.com",
      accounts: process.env.ROBINHOOD_CHAIN_PRIVATE_KEY
        ? [process.env.ROBINHOOD_CHAIN_PRIVATE_KEY]
        : process.env.FHENIX_PRIVATE_KEY
          ? [process.env.FHENIX_PRIVATE_KEY]
          : process.env.FILECOIN_PRIVATE_KEY
            ? [process.env.FILECOIN_PRIVATE_KEY]
            : [],
      chainId: 46630,
    },
    zeroGTestnet: {
      // 0G Galileo Testnet — chainId 16602
      // Faucet: https://faucet.0g.ai
      // Explorer: https://chainscan-galileo.0g.ai
      // Used for GovernanceProof contract — on-chain governance decision proofs
      url: process.env.ZEROG_RPC_URL || "https://evmrpc-testnet.0g.ai",
      accounts: process.env.ZEROG_PRIVATE_KEY
        ? [process.env.ZEROG_PRIVATE_KEY]
        : process.env.OWS_BOOTSTRAP_PRIVATE_KEY
          ? [process.env.OWS_BOOTSTRAP_PRIVATE_KEY]
          : [],
      chainId: 16602,
    },
  },
  paths: {
    sources: path.join(root, "contracts", "src"),
    tests: path.join(root, "test"),
    cache: path.join(root, "build", "cache"),
    artifacts: path.join(root, "build", "artifacts"),
  },
};
