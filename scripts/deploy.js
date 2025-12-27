const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Deploy MockOpinionExchange first (needed for TradeRouter)
  console.log("\n1. Deploying MockOpinionExchange...");
  const MockOpinionExchange = await hre.ethers.getContractFactory("MockOpinionExchange");
  const mockOpinionExchange = await MockOpinionExchange.deploy();
  await mockOpinionExchange.waitForDeployment();
  const mockOpinionAddress = await mockOpinionExchange.getAddress();
  console.log("MockOpinionExchange deployed to:", mockOpinionAddress);

  // Get fee wallet address (use deployer for now, or set via env)
  const feeWallet = process.env.FEE_WALLET_ADDRESS || deployer.address;
  console.log("Fee wallet:", feeWallet);

  // Get fee basis points (default 50 = 0.5%)
  const feeBasisPoints = process.env.FEE_BASIS_POINTS 
    ? parseInt(process.env.FEE_BASIS_POINTS) 
    : 50;

  // Deploy TradeRouter
  console.log("\n2. Deploying TradeRouter...");
  const TradeRouter = await hre.ethers.getContractFactory("TradeRouter");
  const tradeRouter = await TradeRouter.deploy(
    mockOpinionAddress,
    feeWallet,
    feeBasisPoints
  );
  await tradeRouter.waitForDeployment();
  const tradeRouterAddress = await tradeRouter.getAddress();
  console.log("TradeRouter deployed to:", tradeRouterAddress);

  // Deploy FeeTracker (needs TradeRouter address)
  console.log("\n3. Deploying FeeTracker...");
  const FeeTracker = await hre.ethers.getContractFactory("FeeTracker");
  const feeTracker = await FeeTracker.deploy(tradeRouterAddress);
  await feeTracker.waitForDeployment();
  const feeTrackerAddress = await feeTracker.getAddress();
  console.log("FeeTracker deployed to:", feeTrackerAddress);

  // Save deployment addresses to a file
  const network = await hre.ethers.provider.getNetwork();
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    contracts: {
      MockOpinionExchange: mockOpinionAddress,
      TradeRouter: tradeRouterAddress,
      FeeTracker: feeTrackerAddress,
    },
    feeWallet,
    feeBasisPoints,
    timestamp: new Date().toISOString(),
  };

  const deploymentDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }

  const networkName = network.name === "unknown" ? `chain-${network.chainId}` : network.name;
  const deploymentFile = path.join(deploymentDir, `${networkName}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n✅ Deployment complete!");
  console.log("\nContract addresses:");
  console.log("  MockOpinionExchange:", mockOpinionAddress);
  console.log("  TradeRouter:", tradeRouterAddress);
  console.log("  FeeTracker:", feeTrackerAddress);
  console.log("\nDeployment info saved to:", deploymentFile);
  
  console.log("\n📝 Add these to your .env.local file:");
  console.log(`MOCK_OPINION_EXCHANGE_ADDRESS=${mockOpinionAddress}`);
  console.log(`TRADE_ROUTER_ADDRESS=${tradeRouterAddress}`);
  console.log(`FEE_TRACKER_ADDRESS=${feeTrackerAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });












