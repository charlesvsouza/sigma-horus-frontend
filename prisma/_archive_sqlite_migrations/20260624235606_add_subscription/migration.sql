CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lodgeId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "stripeCustomerId" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'oficina',
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "currentPeriodStart" DATETIME,
    "currentPeriodEnd" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Subscription_lodgeId_key" ON "Subscription"("lodgeId");
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");
