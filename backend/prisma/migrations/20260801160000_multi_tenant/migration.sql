-- Multi-tenancy: scope Agent, Policy and Merchant to a User.
-- Existing rows are handed to the oldest user so nothing is orphaned.

-- 1. Add the columns as nullable first, so existing rows survive.
ALTER TABLE "Agent"    ADD COLUMN "userId" TEXT;
ALTER TABLE "Policy"   ADD COLUMN "userId" TEXT;
ALTER TABLE "Merchant" ADD COLUMN "userId" TEXT;

-- 2. Make sure there is at least one user to own the existing data.
INSERT INTO "User" ("id", "name", "email", "password", "role", "createdAt", "updatedAt")
SELECT 'seed-owner-user', 'PolicyPay Admin', 'admin@policypay.demo', NULL, 'ADMIN', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "User");

-- 3. Backfill every existing row to the oldest user.
UPDATE "Agent"    SET "userId" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1) WHERE "userId" IS NULL;
UPDATE "Policy"   SET "userId" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1) WHERE "userId" IS NULL;
UPDATE "Merchant" SET "userId" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1) WHERE "userId" IS NULL;

-- 4. Now that every row has an owner, enforce NOT NULL.
ALTER TABLE "Agent"    ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Policy"   ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Merchant" ALTER COLUMN "userId" SET NOT NULL;

-- 5. Swap global uniqueness for per-tenant uniqueness.
DROP INDEX IF EXISTS "Agent_name_key";
DROP INDEX IF EXISTS "Merchant_domain_key";
CREATE UNIQUE INDEX "Agent_userId_name_key"      ON "Agent"("userId", "name");
CREATE UNIQUE INDEX "Merchant_userId_domain_key" ON "Merchant"("userId", "domain");

-- 6. Indexes for the scoped lookups.
CREATE INDEX "Agent_userId_idx"    ON "Agent"("userId");
CREATE INDEX "Policy_userId_idx"   ON "Policy"("userId");
CREATE INDEX "Merchant_userId_idx" ON "Merchant"("userId");

-- 7. Foreign keys. Deleting a user removes their whole workspace.
ALTER TABLE "Agent"    ADD CONSTRAINT "Agent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Policy"   ADD CONSTRAINT "Policy_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 8. Alerts point at an agent, so they can be scoped through it.
--    Orphaned alerts (agent already gone) are cleared first.
UPDATE "Alert" SET "agentId" = NULL
 WHERE "agentId" IS NOT NULL
   AND "agentId" NOT IN (SELECT "id" FROM "Agent");

ALTER TABLE "Alert" ADD CONSTRAINT "Alert_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Alert_agentId_idx" ON "Alert"("agentId");
