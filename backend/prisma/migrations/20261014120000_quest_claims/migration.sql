CREATE TABLE "QuestClaim" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "points" INTEGER NOT NULL CHECK ("points" > 0),
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestClaim_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QuestClaim_accountId_questId_key" ON "QuestClaim"("accountId", "questId");
ALTER TABLE "QuestClaim" ADD CONSTRAINT "QuestClaim_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
