-- AlterTable
ALTER TABLE "Agreement" ADD COLUMN "absorbedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "AgreementUpdate" ADD COLUMN "amount" DECIMAL(18,2);

-- Agreements monitored by percentage so far keep the same percentage in money terms.
UPDATE "Agreement" SET "absorbedAmount" = ROUND("amount" * "progress" / 100, 2) WHERE "amount" IS NOT NULL;
