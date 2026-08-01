import dotenv from "dotenv";
dotenv.config();

import {
  PrismaClient,
  Role,
  AgentStatus,
  PolicyTemplate,
  MerchantReputation,
  TransactionDecision,
  AlertSeverity,
  AlertType,
} from "@prisma/client";
import bcrypt from "bcrypt";
import crypto from "crypto";

const prisma = new PrismaClient();

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function generateApiKey(): string {
  return "pp_live_" + crypto.randomBytes(16).toString("hex");
}

async function main() {
  console.log("🌱 Starting PolicyPay database seed...");

  // --------------------------------------------------------------------------
  // Delete existing demo rows first in exact FK-safe order:
  // 1. AuditLog
  // 2. Approval
  // 3. Transaction
  // 4. ApiKey
  // 5. Alert
  // 6. Agent
  // 7. Policy
  // 8. Merchant
  // 9. GlobalConfig
  // 10. User
  // --------------------------------------------------------------------------
  console.log("🧹 Deleting existing data in FK-safe order...");
  await prisma.auditLog.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.policy.deleteMany();
  await prisma.merchant.deleteMany();
  await prisma.globalConfig.deleteMany();
  await prisma.user.deleteMany();
  console.log("✅ Existing data cleared.");

  // --------------------------------------------------------------------------
  // 1. GlobalConfig
  // --------------------------------------------------------------------------
  console.log("⚙️ Seeding GlobalConfig...");
  const globalConfig = await prisma.globalConfig.upsert({
    where: { id: "global" },
    update: { killSwitchActive: false },
    create: { id: "global", killSwitchActive: false },
  });

  // --------------------------------------------------------------------------
  // 2. Admin User
  // --------------------------------------------------------------------------
  console.log("👤 Seeding Admin User...");
  const hashedPassword = await bcrypt.hash("Demo1234!", 10);
  const adminUser = await prisma.user.create({
    data: {
      name: "Demo Admin",
      email: "admin@policypay.demo",
      password: hashedPassword,
      role: Role.ADMIN,
    },
  });

  // --------------------------------------------------------------------------
  // 3. Policies
  // --------------------------------------------------------------------------
  console.log("📋 Seeding Policies...");
  const conservativePolicy = await prisma.policy.create({
    data: {
      userId: adminUser.id,
      name: "Conservative",
      template: PolicyTemplate.CONSERVATIVE,
      perTxLimitUsd: 5,
      dailyBudgetUsd: 20,
      monthlyBudgetUsd: 200,
      maxTxPerHour: 20,
      maxTxPerDay: 100,
      approvalThresholdScore: 30,
      denyThresholdScore: 70,
      allowedHoursStart: "08:00",
      allowedHoursEnd: "20:00",
      blockUnknownMerchants: true,
    },
  });

  const moderatePolicy = await prisma.policy.create({
    data: {
      userId: adminUser.id,
      name: "Moderate",
      template: PolicyTemplate.MODERATE,
      perTxLimitUsd: 25,
      dailyBudgetUsd: 100,
      monthlyBudgetUsd: 1000,
      maxTxPerHour: 30,
      maxTxPerDay: 200,
      approvalThresholdScore: 40,
      denyThresholdScore: 80,
      allowedHoursStart: "06:00",
      allowedHoursEnd: "22:00",
      blockUnknownMerchants: true,
    },
  });

  const aggressivePolicy = await prisma.policy.create({
    data: {
      userId: adminUser.id,
      name: "Aggressive",
      template: PolicyTemplate.AGGRESSIVE,
      perTxLimitUsd: 100,
      dailyBudgetUsd: 500,
      monthlyBudgetUsd: 5000,
      maxTxPerHour: 100,
      maxTxPerDay: 1000,
      approvalThresholdScore: 50,
      denyThresholdScore: 90,
      allowedHoursStart: null,
      allowedHoursEnd: null,
      blockUnknownMerchants: false,
    },
  });

  // --------------------------------------------------------------------------
  // 4. Agents
  // --------------------------------------------------------------------------
  console.log("🤖 Seeding Agents...");
  const agentA = await prisma.agent.create({
    data: {
      userId: adminUser.id,
      name: "research-bot-1",
      description: "Buys market data",
      policyId: conservativePolicy.id,
      status: AgentStatus.ACTIVE,
      totalSpent: 24.0,
      totalTx: 6,
    },
  });

  const agentB = await prisma.agent.create({
    data: {
      userId: adminUser.id,
      name: "highvalue-bot-1",
      description: "Bulk data purchases",
      policyId: aggressivePolicy.id,
      status: AgentStatus.ACTIVE,
      totalSpent: 30.0,
      totalTx: 6,
    },
  });

  // --------------------------------------------------------------------------
  // 5. Merchants
  // --------------------------------------------------------------------------
  console.log("🏪 Seeding Merchants...");
  await prisma.merchant.create({
    data: {
      userId: adminUser.id,
      name: "Trusted API",
      domain: "trusted-api.com",
      category: "api",
      reputation: MerchantReputation.TRUSTED,
    },
  });

  await prisma.merchant.create({
    data: {
      userId: adminUser.id,
      name: "Data Provider",
      domain: "data-provider.xyz",
      category: "data",
      reputation: MerchantReputation.TRUSTED,
    },
  });

  await prisma.merchant.create({
    data: {
      userId: adminUser.id,
      name: "Unknown Service",
      domain: "unknown-service.xyz",
      category: "api",
      reputation: MerchantReputation.UNKNOWN,
    },
  });

  await prisma.merchant.create({
    data: {
      userId: adminUser.id,
      name: "Shady Payments",
      domain: "shady-payments.com",
      category: "misc",
      reputation: MerchantReputation.BLOCKED,
    },
  });

  // --------------------------------------------------------------------------
  // 6. Historical ALLOW Transactions
  // --------------------------------------------------------------------------
  console.log("💳 Seeding Historical ALLOW Transactions...");
  const researchAllowAmounts = [3.5, 4.0, 4.5, 4.0, 3.5, 4.5];
  for (let i = 0; i < researchAllowAmounts.length; i++) {
    await prisma.transaction.create({
      data: {
        agentId: agentA.id,
        merchantDomain: "trusted-api.com",
        merchantName: "Trusted API",
        amountUsd: researchAllowAmounts[i],
        currency: "USDC",
        purpose: "Market data query",
        idempotencyKey: `seed-allow-research-${i + 1}`,
        decision: TransactionDecision.ALLOW,
        riskScore: 5,
        reasonCodes: ["ALL_CHECKS_PASSED"],
        policyChecks: [],
        riskBreakdown: [],
        createdAt: daysAgo(6 - i),
      },
    });
  }

  const highvalueAllowAmounts = [5.0, 5.0, 5.0, 5.0, 5.0, 5.0];
  for (let i = 0; i < highvalueAllowAmounts.length; i++) {
    await prisma.transaction.create({
      data: {
        agentId: agentB.id,
        merchantDomain: "trusted-api.com",
        merchantName: "Trusted API",
        amountUsd: highvalueAllowAmounts[i],
        currency: "USDC",
        purpose: "Bulk data purchase",
        idempotencyKey: `seed-allow-highvalue-${i + 1}`,
        decision: TransactionDecision.ALLOW,
        riskScore: 5,
        reasonCodes: ["ALL_CHECKS_PASSED"],
        policyChecks: [],
        riskBreakdown: [],
        createdAt: daysAgo(6 - i),
      },
    });
  }

  // --------------------------------------------------------------------------
  // 7. DENY Transactions
  // --------------------------------------------------------------------------
  console.log("🚫 Seeding DENY Transactions...");
  await prisma.transaction.create({
    data: {
      agentId: agentA.id,
      merchantDomain: "shady-payments.com",
      merchantName: "Shady Payments",
      amountUsd: 12.0,
      currency: "USDC",
      purpose: "Suspicious API access",
      idempotencyKey: "seed-deny-research-1",
      decision: TransactionDecision.DENY,
      riskScore: 45,
      reasonCodes: ["MERCHANT_BLOCKED"],
      policyChecks: [],
      riskBreakdown: [],
      createdAt: daysAgo(2),
    },
  });

  await prisma.transaction.create({
    data: {
      agentId: agentA.id,
      merchantDomain: "unknown-service.xyz",
      merchantName: "Unknown Service",
      amountUsd: 8.0,
      currency: "USDC",
      purpose: "Unknown API query",
      idempotencyKey: "seed-deny-research-2",
      decision: TransactionDecision.DENY,
      riskScore: 40,
      reasonCodes: ["MERCHANT_NOT_ALLOWED"],
      policyChecks: [],
      riskBreakdown: [],
      createdAt: daysAgo(1),
    },
  });

  // --------------------------------------------------------------------------
  // 8. Alerts
  // --------------------------------------------------------------------------
  console.log("🚨 Seeding Alerts...");
  await prisma.alert.create({
    data: {
      severity: AlertSeverity.HIGH,
      type: AlertType.TRANSACTION_BLOCKED,
      title: "Transaction Blocked",
      description: "Payment to shady-payments.com blocked by policy for research-bot-1",
      agentId: agentA.id,
      isDismissed: false,
    },
  });

  await prisma.alert.create({
    data: {
      severity: AlertSeverity.MEDIUM,
      type: AlertType.UNKNOWN_MERCHANT,
      title: "Unknown Merchant",
      description: "Attempted transaction with unknown merchant unknown-service.xyz for research-bot-1",
      agentId: agentA.id,
      isDismissed: false,
    },
  });

  await prisma.alert.create({
    data: {
      severity: AlertSeverity.LOW,
      type: AlertType.BUDGET_THRESHOLD,
      title: "Budget Threshold Warning",
      description: "Daily budget threshold reached 80% for research-bot-1",
      agentId: agentA.id,
      isDismissed: false,
    },
  });

  // --------------------------------------------------------------------------
  // 9. API Keys
  // --------------------------------------------------------------------------
  console.log("🔑 Seeding API Keys...");
  const rawKeyA = generateApiKey();
  const keyHashA = await bcrypt.hash(rawKeyA, 10);
  await prisma.apiKey.create({
    data: {
      keyHash: keyHashA,
      keyPrefix: rawKeyA.slice(0, 12),
      name: "research-bot-1 Key",
      agentId: agentA.id,
    },
  });

  const rawKeyB = generateApiKey();
  const keyHashB = await bcrypt.hash(rawKeyB, 10);
  await prisma.apiKey.create({
    data: {
      keyHash: keyHashB,
      keyPrefix: rawKeyB.slice(0, 12),
      name: "highvalue-bot-1 Key",
      agentId: agentB.id,
    },
  });

  // --------------------------------------------------------------------------
  // Print API Keys and Agent IDs
  // --------------------------------------------------------------------------
  console.log("\n============================================================");
  console.log(`research-bot-1 Agent ID : ${agentA.id}`);
  console.log(`research-bot-1 API KEY : ${rawKeyA}`);
  console.log("------------------------------------------------------------");
  console.log(`highvalue-bot-1 Agent ID: ${agentB.id}`);
  console.log(`highvalue-bot-1 API KEY : ${rawKeyB}`);
  console.log("============================================================\n");

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log("🎉 Database seeding completed successfully!");
  console.log("Summary of Seeded Resources:");
  console.log(` - GlobalConfig : 1 (killSwitchActive = false)`);
  console.log(` - User         : 1 (${adminUser.email})`);
  console.log(` - Policies     : 3 (Conservative, Moderate, Aggressive)`);
  console.log(` - Agents       : 2 (${agentA.name}, ${agentB.name})`);
  console.log(` - Merchants    : 4 (Trusted API, Data Provider, Unknown Service, Shady Payments)`);
  console.log(` - Transactions : 14 (12 ALLOW, 2 DENY)`);
  console.log(` - Alerts       : 3 (HIGH, MEDIUM, LOW)`);
  console.log(` - API Keys     : 2 generated & printed above`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
