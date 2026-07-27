import { redis } from "../config/redis";

function getFormattedDates(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return {
    yyyyMmDd: `${yyyy}-${mm}-${dd}`,
    yyyyMm: `${yyyy}-${mm}`,
  };
}

export class BudgetEngineService {
  async getDailySpend(agentId: string): Promise<number> {
    const { yyyyMmDd } = getFormattedDates();
    const key = `spend:daily:${agentId}:${yyyyMmDd}`;
    const val = await redis.get(key);
    return val ? parseFloat(val) : 0;
  }

  async getMonthlySpend(agentId: string): Promise<number> {
    const { yyyyMm } = getFormattedDates();
    const key = `spend:monthly:${agentId}:${yyyyMm}`;
    const val = await redis.get(key);
    return val ? parseFloat(val) : 0;
  }

  async addSpend(agentId: string, amount: number): Promise<void> {
    const { yyyyMmDd, yyyyMm } = getFormattedDates();
    const dailyKey = `spend:daily:${agentId}:${yyyyMmDd}`;
    const monthlyKey = `spend:monthly:${agentId}:${yyyyMm}`;

    await redis.incrbyfloat(dailyKey, amount);
    await redis.expire(dailyKey, 48 * 3600); // 48 hours

    await redis.incrbyfloat(monthlyKey, amount);
    await redis.expire(monthlyKey, 40 * 24 * 3600); // 40 days
  }
}

export const budgetEngineService = new BudgetEngineService();
