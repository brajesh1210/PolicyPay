import { redis } from "../src/config/redis";

const PATTERNS = [
  "spend:daily:*",
  "spend:monthly:*",
  "freq:hour:*",
  "freq:day:*",
  "burst:*",
  "intent:*",
];

async function scanAndDeletePattern(pattern: string): Promise<number> {
  let cursor = "0";
  let totalDeleted = 0;

  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = nextCursor;

    if (keys.length > 0) {
      const deleted = await redis.del(...keys);
      totalDeleted += deleted;
    }
  } while (cursor !== "0");

  return totalDeleted;
}

async function main() {
  console.log("🧹 Starting PolicyPay Redis counter reset...");

  let grandTotalDeleted = 0;

  for (const pattern of PATTERNS) {
    const deletedCount = await scanAndDeletePattern(pattern);
    console.log(` - Pattern "${pattern}": deleted ${deletedCount} key(s)`);
    grandTotalDeleted += deletedCount;
  }

  console.log(`\n✅ Reset completed! Total Redis keys deleted: ${grandTotalDeleted}`);
}

main()
  .catch((err) => {
    console.error("❌ Redis reset failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await redis.quit();
    process.exit(0);
  });
