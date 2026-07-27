import { redis } from "../config/redis";

function getFormattedTimes(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  return {
    yyyyMmDdHh: `${yyyy}-${mm}-${dd}-${hh}`,
    yyyyMmDd: `${yyyy}-${mm}-${dd}`,
  };
}

export class FrequencyEngineService {
  async getHourCount(agentId: string): Promise<number> {
    const { yyyyMmDdHh } = getFormattedTimes();
    const key = `freq:hour:${agentId}:${yyyyMmDdHh}`;
    const val = await redis.get(key);
    return val ? parseInt(val, 10) : 0;
  }

  async getDayCount(agentId: string): Promise<number> {
    const { yyyyMmDd } = getFormattedTimes();
    const key = `freq:day:${agentId}:${yyyyMmDd}`;
    const val = await redis.get(key);
    return val ? parseInt(val, 10) : 0;
  }

  async increment(agentId: string): Promise<void> {
    const { yyyyMmDdHh, yyyyMmDd } = getFormattedTimes();
    const hourKey = `freq:hour:${agentId}:${yyyyMmDdHh}`;
    const dayKey = `freq:day:${agentId}:${yyyyMmDd}`;

    await redis.incr(hourKey);
    await redis.expire(hourKey, 2 * 3600); // 2 hours

    await redis.incr(dayKey);
    await redis.expire(dayKey, 48 * 3600); // 48 hours
  }

  async recordBurst(agentId: string): Promise<void> {
    const now = Date.now();
    const burstKey = `burst:${agentId}`;
    const member = `${now}-${Math.random().toString(36).slice(2, 8)}`;

    await redis.zadd(burstKey, now, member);
    const tenMinutesAgo = now - 10 * 60 * 1000;
    await redis.zremrangebyscore(burstKey, "-inf", tenMinutesAgo - 1);
    await redis.expire(burstKey, 900);
  }

  async countBurst(agentId: string): Promise<number> {
    const now = Date.now();
    const burstKey = `burst:${agentId}`;
    const tenMinutesAgo = now - 10 * 60 * 1000;
    return redis.zcount(burstKey, tenMinutesAgo, "+inf");
  }
}

export const frequencyEngineService = new FrequencyEngineService();
