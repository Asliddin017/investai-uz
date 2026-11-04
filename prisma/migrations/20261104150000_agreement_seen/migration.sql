-- CreateTable
CREATE TABLE "AgreementSeen" (
    "userId" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgreementSeen_pkey" PRIMARY KEY ("userId","agreementId")
);

-- AddForeignKey
ALTER TABLE "AgreementSeen" ADD CONSTRAINT "AgreementSeen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementSeen" ADD CONSTRAINT "AgreementSeen_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
