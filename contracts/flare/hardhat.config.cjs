const path = require("path");
require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-chai-matchers");
require("dotenv").config({
  path: path.resolve(__dirname, "..", "..", ".env.local"),
});
require("dotenv").config({
  path: path.resolve(__dirname, "..", "..", ".env"),
});

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.27",
    settings: {
      evmVersion: "cancun",
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {
      // Allow deploying against mock registries that we deploy in tests.
      allowUnlimitedContractSize: true,
    },
    coston2: {
      url:
        process.env.FLARE_RPC_URL ||
        process.env.COSTON2_RPC_URL ||
        "https://coston2-api.flare.network/ext/C/rpc",
      chainId: 114,
      accounts: process.env.FLARE_PRIVATE_KEY
        ? [process.env.FLARE_PRIVATE_KEY]
        : process.env.FHENIX_PRIVATE_KEY
          ? [process.env.FHENIX_PRIVATE_KEY]
          : [],
    },
  },
  paths: {
    sources: path.join(__dirname, "src"),
    tests: path.join(__dirname, "test"),
    cache: path.join(__dirname, "build", "cache"),
    artifacts: path.join(__dirname, "build", "artifacts"),
  },
};
