const path = require('path');
require('@nomicfoundation/hardhat-toolbox');

const root = path.resolve(__dirname, '..');
// A deployment-only env file can be selected explicitly without changing the
// existing .env/.env.local values used by other integrations. Keep the file
// ignored and populate it from a secret manager rather than committing it.
if (process.env.ZEROG_MAINNET_ENV_FILE) {
  require('dotenv').config({
    path: path.resolve(root, process.env.ZEROG_MAINNET_ENV_FILE),
  });
}
if (process.env.XLAYER_MAINNET_ENV_FILE) {
  require('dotenv').config({
    path: path.resolve(root, process.env.XLAYER_MAINNET_ENV_FILE),
  });
}
require('dotenv').config({ path: path.resolve(root, '.env.local') });
require('dotenv').config({ path: path.resolve(root, '.env') });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: '0.8.19',
  networks: {
    calibration: {
      url: process.env.FILECOIN_RPC_URL || 'https://api.calibration.node.glif.io/rpc/v1',
      accounts: process.env.FILECOIN_PRIVATE_KEY ? [process.env.FILECOIN_PRIVATE_KEY] : [],
      chainId: 314159,
    },
    xlayer: {
      url: process.env.XLAYER_RPC_URL || 'https://rpc.xlayer.tech',
      accounts: process.env.XLAYER_PRIVATE_KEY ? [process.env.XLAYER_PRIVATE_KEY] : [],
      chainId: 196,
    },
    xlayerTestnet: {
      url: process.env.XLAYER_TESTNET_RPC_URL || 'https://testrpc.xlayer.tech',
      accounts: process.env.XLAYER_PRIVATE_KEY ? [process.env.XLAYER_PRIVATE_KEY] : [],
      chainId: 1952,
    },
    xlayerMainnet: {
      // X Layer Mainnet — chainId 196. The GovernanceProofV2 anchor requires
      // an explicitly dedicated deployment key; never fall back to the shared
      // XLAYER_PRIVATE_KEY used for testnet.
      url: process.env.XLAYER_MAINNET_RPC_URL || 'https://rpc.xlayer.tech',
      accounts: process.env.XLAYER_MAINNET_DEPLOYER_PRIVATE_KEY
        ? [process.env.XLAYER_MAINNET_DEPLOYER_PRIVATE_KEY]
        : [],
      chainId: 196,
    },
    mantle: {
      url: process.env.MANTLE_RPC_URL || 'https://rpc.mantle.xyz',
      accounts: process.env.MANTLE_PRIVATE_KEY ? [process.env.MANTLE_PRIVATE_KEY] : [],
      chainId: 5000,
    },
    mantleSepolia: {
      url: process.env.MANTLE_SEPOLIA_RPC_URL || 'https://rpc.sepolia.mantle.xyz',
      accounts: process.env.MANTLE_PRIVATE_KEY ? [process.env.MANTLE_PRIVATE_KEY] : [],
      chainId: 5003,
    },
    arbitrumSepolia: {
      url: process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
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
      url: process.env.ROBINHOOD_CHAIN_TESTNET_RPC_URL || 'https://rpc.testnet.chain.robinhood.com',
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
      // Used for the existing V1 GovernanceProof contract.
      url: process.env.ZEROG_RPC_URL || 'https://evmrpc-testnet.0g.ai',
      accounts: process.env.ZEROG_PRIVATE_KEY
        ? [process.env.ZEROG_PRIVATE_KEY]
        : process.env.OWS_BOOTSTRAP_PRIVATE_KEY
          ? [process.env.OWS_BOOTSTRAP_PRIVATE_KEY]
          : [],
      chainId: 16602,
    },
    zeroGMainnet: {
      // 0G Mainnet / Aristotle — chainId 16661
      // Explorer: https://chainscan.0g.ai
      // V2 requires an explicitly dedicated deployment key; never fall back
      // to the OWS bootstrap or testnet proof key.
      url: process.env.ZEROG_MAINNET_RPC_URL || 'https://evmrpc.0g.ai',
      accounts: process.env.ZEROG_MAINNET_DEPLOYER_PRIVATE_KEY
        ? [process.env.ZEROG_MAINNET_DEPLOYER_PRIVATE_KEY]
        : [],
      chainId: 16661,
    },
  },
  paths: {
    sources: path.join(root, 'contracts', 'src'),
    tests: path.join(root, 'test'),
    cache: path.join(root, 'build', 'cache'),
    artifacts: path.join(root, 'build', 'artifacts'),
  },
};
