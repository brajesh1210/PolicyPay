import { Policy, TransactionDecision, MerchantReputation } from "@prisma/client";
import { RiskFactor, REASON_CODES } from "@policypay/contracts";
import { prisma } from "../config/database";
import { frequencyEngineService } from "./frequencyEngine.service";

export interface CalculateRiskInput {
  agentId: string;
  policy: Policy;
  amountUsd: number;
  merchantReputation: MerchantReputation | "TRUSTED" | "UNKNOWN" | "BLOCKED";
  injectionFlagged: boolean;
  now: Date;
}

export interface CalculateRiskResult {
  score: number;
  breakdown: RiskFactor[];
  reasonCodes: string[];
}

export async function calculateRisk(input: CalculateRiskInput): Promise<CalculateRiskResult> {
  const { agentId, policy, amountUsd, merchantReputation, injectionFlagged, now } = input;

  const breakdown: RiskFactor[] = [];
  const reasonCodes: string[] = [];
  let totalPoints = 0;

  // --------------------------------------------------------------------------
  // STEP 1 - Historical Average
  // --------------------------------------------------------------------------
  const recentTx = await prisma.transaction.findMany({
    where: {
      agentId,
      decision: TransactionDecision.ALLOW,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 20,
    select: {
      amountUsd: true,
    },
  });

  let historicalAverage: number;
  if (recentTx.length > 0) {
    const sum = recentTx.reduce((acc, tx) => acc + tx.amountUsd, 0);
    historicalAverage = sum / recentTx.length;
  } else {
    historicalAverage = policy.dailyBudgetUsd / 10;
  }

  // Guard against division by zero
  if (historicalAverage === 0) {
    historicalAverage = 0.01;
  }

  // --------------------------------------------------------------------------
  // STEP 2 - Merchant Reputation
  // --------------------------------------------------------------------------
  if (merchantReputation === "UNKNOWN") {
    const points = 25;
    totalPoints += points;
    breakdown.push({
      factor: "merchant_reputation",
      points,
      detail: "Merchant reputation is UNKNOWN",
    });
    reasonCodes.push(REASON_CODES.UNKNOWN_MERCHANT_RISK);
  }

  // --------------------------------------------------------------------------
  // STEP 3 - Amount Anomaly
  // --------------------------------------------------------------------------
  const ratio = amountUsd / historicalAverage;
  let anomalyPoints = 0;

  if (ratio >= 5) {
    anomalyPoints = 60;
  } else if (ratio >= 3) {
    anomalyPoints = 40;
  } else if (ratio >= 1.5) {
    anomalyPoints = 20;
  }

  if (anomalyPoints > 0) {
    totalPoints += anomalyPoints;
    breakdown.push({
      factor: "amount_anomaly",
      points: anomalyPoints,
      detail: `${ratio.toFixed(2)}x historical average`,
    });
    reasonCodes.push(REASON_CODES.AMOUNT_ANOMALY);
  }

  // --------------------------------------------------------------------------
  // STEP 4 - Frequency Burst
  // --------------------------------------------------------------------------
  const burstCount = await frequencyEngineService.countBurst(agentId);
  if (burstCount > 3) {
    const points = 20;
    totalPoints += points;
    breakdown.push({
      factor: "frequency_burst",
      points,
      detail: `${burstCount} transactions in last 10 minutes`,
    });
    reasonCodes.push(REASON_CODES.FREQUENCY_BURST);
  }

  // --------------------------------------------------------------------------
  // STEP 5 - Off Hours
  // --------------------------------------------------------------------------
  if (policy.allowedHoursStart && policy.allowedHoursEnd) {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = policy.allowedHoursStart.split(":").map(Number);
    const startMinutes = startH * 60 + startM;

    const [endH, endM] = policy.allowedHoursEnd.split(":").map(Number);
    const endMinutes = endH * 60 + endM;

    let isOutside = false;
    if (startMinutes <= endMinutes) {
      isOutside = currentMinutes < startMinutes || currentMinutes > endMinutes;
    } else {
      // Overnight window (e.g. 22:00 to 06:00)
      isOutside = currentMinutes < startMinutes && currentMinutes > endMinutes;
    }

    if (isOutside) {
      const points = 15;
      totalPoints += points;
      breakdown.push({
        factor: "off_hours",
        points,
        detail: `Transaction at ${now.toTimeString().slice(0, 5)} outside allowed window ${policy.allowedHoursStart}-${policy.allowedHoursEnd}`,
      });
      reasonCodes.push(REASON_CODES.OFF_HOURS);
    }
  }

  // --------------------------------------------------------------------------
  // STEP 6 - Prompt Injection
  // --------------------------------------------------------------------------
  if (injectionFlagged) {
    const points = 80;
    totalPoints += points;
    breakdown.push({
      factor: "prompt_injection",
      points,
      detail: "Suspected prompt injection phrase detected",
    });
    reasonCodes.push(REASON_CODES.PROMPT_INJECTION_SUSPECTED);
  }

  // --------------------------------------------------------------------------
  // STEP 7 - Cap
  // --------------------------------------------------------------------------
  const score = Math.min(100, totalPoints);

  return {
    score,
    breakdown,
    reasonCodes,
  };
}
