require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.20",
  networks: {
    amoy: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-amoy-bor-rpc.publicnode.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 80002
    },
    hardhat: {
      chainId: 1337
    }
  },
  etherscan: {
    apiKey: process.env.POLYGONSCAN_API_KEY || ""
  }
};