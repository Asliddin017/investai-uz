-- CreateTable
CREATE TABLE "PlanSeen" (
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanSeen_pkey" PRIMARY KEY ("userId","planId")
);

-- AddForeignKey
ALTER TABLE "PlanSeen" ADD CONSTRAINT "PlanSeen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanSeen" ADD CONSTRAINT "PlanSeen_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
