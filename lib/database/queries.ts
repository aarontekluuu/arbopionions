/**
 * Database queries for pm.ag terminal
 * 
 * These functions query the Prisma database for trades, fees, and metrics
 * 
 * NOTE: Prisma client must be generated before use:
 *   npx prisma generate
 * 
 * Database must be set up:
 *   npx prisma migrate dev
 */

// Prisma client will be initialized lazily to avoid errors if not set up
let prisma: any = null;

function getPrisma() {
  if (!prisma) {
    try {
      // Dynamic import to avoid build errors if Prisma isn't set up
      const { PrismaClient } = require("@prisma/client");
      prisma = new PrismaClient();
    } catch (error) {
      // Prisma not available - return null
      return null;
    }
  }
  return prisma;
}

/**
 * Create a new trade record
 */
export async function createTrade(data: {
  tradeId: bigint;
  userAddress: string;
  marketId: number;
  topicId?: number;
  side: "yes" | "no";
  amount: string;
  fee: string;
  price?: string;
  txHash?: string;
  blockNumber?: bigint;
  timestamp: Date;
}) {
  const db = getPrisma();
  if (!db) {
    throw new Error("Database not configured. Please run: npx prisma generate && npx prisma migrate dev");
  }
  return db.trade.create({
    data: {
      tradeId: data.tradeId,
      userAddress: data.userAddress.toLowerCase(),
      marketId: data.marketId,
      topicId: data.topicId,
      side: data.side,
      amount: data.amount,
      fee: data.fee,
      price: data.price,
      txHash: data.txHash,
      blockNumber: data.blockNumber,
      timestamp: data.timestamp,
    },
  });
}

/**
 * Get trades for a user
 */
export async function getUserTrades(
  userAddress: string,
  limit: number = 50,
  offset: number = 0
) {
  const db = getPrisma();
  if (!db) {
    return []; // Return empty array if DB not configured
  }
  return db.trade.findMany({
    where: {
      userAddress: userAddress.toLowerCase(),
    },
    orderBy: {
      timestamp: "desc",
    },
    take: limit,
    skip: offset,
  });
}

/**
 * Get user metrics
 */
export async function getUserMetrics(userAddress: string) {
  const db = getPrisma();
  if (!db) {
    return null;
  }
  return db.userMetrics.findUnique({
    where: {
      userAddress: userAddress.toLowerCase(),
    },
  });
}

/**
 * Update user metrics after a trade
 */
export async function updateUserMetrics(
  userAddress: string,
  data: {
    amount: string;
    fee: string;
    isWinning?: boolean;
  }
) {
  const db = getPrisma();
  if (!db) {
    throw new Error("Database not configured");
  }
  const updateData: any = {
    totalTrades: { increment: 1 },
    totalVolume: { increment: data.amount },
    totalFees: { increment: data.fee },
    lastTradeAt: new Date(),
  };

  if (data.isWinning !== undefined) {
    if (data.isWinning) {
      updateData.winningTrades = { increment: 1 };
    } else {
      updateData.losingTrades = { increment: 1 };
    }
  }

  return db.userMetrics.upsert({
    where: { userAddress: userAddress.toLowerCase() },
    create: {
      userAddress: userAddress.toLowerCase(),
      totalTrades: 1,
      totalVolume: data.amount,
      totalFees: data.fee,
      winningTrades: data.isWinning ? 1 : 0,
      losingTrades: data.isWinning ? 0 : 1,
      lastTradeAt: new Date(),
    },
    update: updateData,
  });
}

/**
 * Get system metrics for a date
 */
export async function getSystemMetrics(date: Date) {
  const db = getPrisma();
  if (!db) {
    return null;
  }
  const dateOnly = new Date(date.toISOString().split("T")[0]);
  
  return db.systemMetrics.upsert({
    where: { date: dateOnly },
    create: {
      date: dateOnly,
      totalTrades: 0,
      totalVolume: "0",
      totalFees: "0",
      activeUsers: 0,
    },
    update: {},
  });
}

/**
 * Update system metrics
 */
export async function updateSystemMetrics(
  date: Date,
  data: {
    amount: string;
    fee: string;
    newUser?: boolean;
  }
) {
  const db = getPrisma();
  if (!db) {
    throw new Error("Database not configured");
  }
  const dateOnly = new Date(date.toISOString().split("T")[0]);
  
  const updateData: any = {
    totalTrades: { increment: 1 },
    totalVolume: { increment: data.amount },
    totalFees: { increment: data.fee },
  };

  if (data.newUser) {
    updateData.activeUsers = { increment: 1 };
  }

  return db.systemMetrics.upsert({
    where: { date: dateOnly },
    create: {
      date: dateOnly,
      totalTrades: 1,
      totalVolume: data.amount,
      totalFees: data.fee,
      activeUsers: data.newUser ? 1 : 0,
    },
    update: updateData,
  });
}

/**
 * Get total fees collected
 */
export async function getTotalFees(): Promise<string> {
  const db = getPrisma();
  if (!db) {
    return "0";
  }
  const result = await db.fee.aggregate({
    _sum: {
      amount: true,
    },
  });
  return result._sum.amount?.toString() || "0";
}

/**
 * Get total volume
 */
export async function getTotalVolume(): Promise<string> {
  const db = getPrisma();
  if (!db) {
    return "0";
  }
  const result = await db.trade.aggregate({
    _sum: {
      amount: true,
    },
  });
  return result._sum.amount?.toString() || "0";
}

/**
 * Get total trades count
 */
export async function getTotalTrades(): Promise<number> {
  const db = getPrisma();
  if (!db) {
    return 0;
  }
  return db.trade.count();
}

/**
 * Get active users count (users who traded in last 30 days)
 */
export async function getActiveUsers(): Promise<number> {
  const db = getPrisma();
  if (!db) {
    return 0;
  }
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const uniqueUsers = await db.trade.findMany({
    where: {
      timestamp: {
        gte: thirtyDaysAgo,
      },
    },
    select: {
      userAddress: true,
    },
    distinct: ["userAddress"],
  });
  
  return uniqueUsers.length;
}

/**
 * Get trade by tradeId
 */
export async function getTradeByTradeId(tradeId: bigint) {
  const db = getPrisma();
  if (!db) {
    return null;
  }
  return db.trade.findUnique({
    where: { tradeId },
  });
}
