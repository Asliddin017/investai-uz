-- CreateTable
CREATE TABLE "ReportReminder" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReportReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportReminder_planId_resolvedAt_idx" ON "ReportReminder"("planId", "resolvedAt");

-- AddForeignKey
ALTER TABLE "ReportReminder" ADD CONSTRAINT "ReportReminder_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportReminder" ADD CONSTRAINT "ReportReminder_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- New catalog permission: granted to the approver and Super Admin roles by default.
INSERT INTO "RolePermission" ("role", "permission")
VALUES ('TASDIQLOVCHI', 'plan:remind_report'), ('SUPER_ADMIN', 'plan:remind_report')
ON CONFLICT DO NOTHING;
