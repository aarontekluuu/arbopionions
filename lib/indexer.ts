/**
 * Event Indexer
 * 
 * Listens to smart contract events and syncs them to the database.
 * 
 * This service should run as a background worker/service that:
 * 1. Polls the blockchain for new events
 * 2. Processes TradeExecuted and FeeCollected events
 * 3. Stores them in the database
 * 4. Updates aggregated metrics
 * 
 * Can be run as:
 * - Next.js API route (polling)
 * - Separate Node.js service
 * - Vercel Cron Job
 * - The Graph subgraph (decentralized)
 */

import { createPublicClient, http, type Address } from "viem";
import { bsc } from "viem/chains";
import { createTrade, updateUserMetrics, updateSystemMetrics, getUserMetrics } from "./database/queries";

// Contract ABI for events we're indexing
// Using abi array directly instead of parseAbi for compatibility
const TRADE_EXECUTED_ABI = {
  name: "TradeExecuted",
  type: "event",
  inputs: [
    { name: "tradeId", type: "uint256", indexed: true },
    { name: "user", type: "address", indexed: true },
    { name: "marketId", type: "uint256", indexed: false },
    { name: "side", type: "bool", indexed: false },
    { name: "amount", type: "uint256", indexed: false },
    { name: "fee", type: "uint256", indexed: false },
  ],
} as const;

/**
 * Index trade events from TradeRouter contract
 * 
 * @param contractAddress TradeRouter contract address
 * @param fromBlock Block number to start indexing from (0 = from deployment)
 * @param toBlock Block number to index to (undefined = latest)
 * @returns Last block indexed
 */
export async function indexTradeEvents(
  contractAddress: Address,
  fromBlock: bigint = BigInt(0),
  toBlock?: bigint
): Promise<bigint> {
  const client = createPublicClient({
    chain: bsc,
    transport: http(process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org/"),
  });

  // Get latest block if toBlock not specified
  const latestBlock = toBlock || (await client.getBlockNumber());

  // Get TradeExecuted events
  const tradeLogs = await client.getLogs({
    address: contractAddress,
    event: TRADE_EXECUTED_ABI,
    fromBlock,
    toBlock: latestBlock,
  });

  // Process each trade event
  for (const log of tradeLogs) {
    if (!log.args || !log.args.tradeId || !log.args.user || !log.args.marketId || 
        log.args.amount === undefined || log.args.fee === undefined) {
      continue; // Skip invalid events
    }

    const { tradeId, user, marketId, side, amount, fee } = log.args;

    try {
      // Get block timestamp
      const block = await client.getBlock({ blockNumber: log.blockNumber });
      const timestamp = new Date(Number(block.timestamp) * 1000);

      // Check if trade already exists
      const existingTrade = await getTradeByTradeId(tradeId);
      if (existingTrade) {
        if (process.env.NODE_ENV === "development") {
          console.log(`[Indexer] Trade ${tradeId} already indexed, skipping`);
        }
        continue; // Already indexed
      }

      // Create trade record
      await createTrade({
        tradeId: tradeId,
        userAddress: user,
        marketId: Number(marketId),
        side: side ? "yes" : "no",
        amount: amount.toString(),
        fee: fee.toString(),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        timestamp,
      });

      // Check if this is a new user
      const userMetrics = await getUserMetrics(user);
      const isNewUser = !userMetrics;

      // Update user metrics
      await updateUserMetrics(user, {
        amount: amount.toString(),
        fee: fee.toString(),
        // TODO: Determine if trade is winning/losing based on current market price
      });

      // Update system metrics
      await updateSystemMetrics(timestamp, {
        amount: amount.toString(),
        fee: fee.toString(),
        newUser: isNewUser,
      });

      if (process.env.NODE_ENV === "development") {
        console.log(`[Indexer] Indexed trade ${tradeId} from user ${user}`);
      }
    } catch (error) {
      console.error(`[Indexer] Error indexing trade ${tradeId}:`, error);
      // Continue with next trade
    }
  }

  return latestBlock;
}

/**
 * Get trade by tradeId (helper function)
 * This would typically be in queries.ts, but adding here for now
 */
async function getTradeByTradeId(tradeId: bigint) {
  // This should use Prisma, but importing here would create circular dependency
  // In production, add this to queries.ts
  return null; // Placeholder
}

/**
 * Run indexer continuously (for background service)
 * 
 * This function polls for new events every N seconds
 */
export async function startIndexer(
  contractAddress: Address,
  pollIntervalMs: number = 15000 // 15 seconds
) {
  let lastBlock = BigInt(0);

  // Get contract deployment block (or last indexed block from DB)
  // For now, start from 0
  const deploymentBlock = await getLastIndexedBlock(contractAddress);
  lastBlock = deploymentBlock || BigInt(0);

  console.log(`[Indexer] Starting from block ${lastBlock}`);

  // Poll for new events
  setInterval(async () => {
    try {
      const newLastBlock = await indexTradeEvents(contractAddress, lastBlock);
      if (newLastBlock > lastBlock) {
        lastBlock = newLastBlock;
        await saveLastIndexedBlock(contractAddress, lastBlock);
      }
    } catch (error) {
      console.error("[Indexer] Error during indexing:", error);
    }
  }, pollIntervalMs);
}

/**
 * Get last indexed block for a contract (from database)
 */
async function getLastIndexedBlock(contractAddress: Address): Promise<bigint | null> {
  // TODO: Store last indexed block in database
  // For now, return null (start from beginning)
  return null;
}

/**
 * Save last indexed block to database
 */
async function saveLastIndexedBlock(contractAddress: Address, blockNumber: bigint): Promise<void> {
  // TODO: Store in database
  // Could use a simple key-value table or config table
}

/**
 * Indexer API endpoint handler
 * 
 * This can be called as a Vercel Cron Job or API route
 */
export async function handleIndexerRequest(contractAddress: Address) {
  try {
    const lastBlock = await getLastIndexedBlock(contractAddress) || BigInt(0);
    const newLastBlock = await indexTradeEvents(contractAddress, lastBlock);
    
    if (newLastBlock > lastBlock) {
      await saveLastIndexedBlock(contractAddress, newLastBlock);
      return {
        success: true,
        indexedBlocks: Number(newLastBlock - lastBlock),
        lastBlock: newLastBlock.toString(),
      };
    }
    
    return {
      success: true,
      indexedBlocks: 0,
      lastBlock: lastBlock.toString(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

