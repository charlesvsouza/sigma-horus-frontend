-- Secretaria: processo de admissão de candidatos (pré-proposta → sindicância → escrutínio → Potência → iniciação).
-- CreateTable
CREATE TABLE "CandidateProcess" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "proposerId" TEXT,
    "preProposalDate" TIMESTAMP(3),
    "proposalReadingDate" TIMESTAMP(3),
    "inquiryOpenedAt" TIMESTAMP(3),
    "inquiryDeadline" TIMESTAMP(3),
    "inquiryClosedAt" TIMESTAMP(3),
    "inquiryResult" TEXT,
    "ballotDate" TIMESTAMP(3),
    "ballotResult" TEXT,
    "potencySentAt" TIMESTAMP(3),
    "potencyApprovedAt" TIMESTAMP(3),
    "potencyReference" TEXT,
    "initiationScheduledAt" TIMESTAMP(3),
    "initiatedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateInquirer" (
    "id" TEXT NOT NULL,
    "lodgeId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3),
    "opinion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateInquirer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CandidateProcess_memberId_key" ON "CandidateProcess"("memberId");

-- CreateIndex
CREATE INDEX "CandidateProcess_lodgeId_idx" ON "CandidateProcess"("lodgeId");

-- CreateIndex
CREATE INDEX "CandidateInquirer_lodgeId_idx" ON "CandidateInquirer"("lodgeId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateInquirer_processId_memberId_key" ON "CandidateInquirer"("processId", "memberId");

-- AddForeignKey
ALTER TABLE "CandidateProcess" ADD CONSTRAINT "CandidateProcess_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProcess" ADD CONSTRAINT "CandidateProcess_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProcess" ADD CONSTRAINT "CandidateProcess_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateInquirer" ADD CONSTRAINT "CandidateInquirer_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateInquirer" ADD CONSTRAINT "CandidateInquirer_processId_fkey" FOREIGN KEY ("processId") REFERENCES "CandidateProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateInquirer" ADD CONSTRAINT "CandidateInquirer_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Grants ao role de aplicação
GRANT SELECT, INSERT, UPDATE, DELETE ON "CandidateProcess" TO sigma_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "CandidateInquirer" TO sigma_app;

-- RLS por tenant (mesmo padrão das demais tabelas)
ALTER TABLE "CandidateProcess" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CandidateProcess" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "CandidateProcess";
CREATE POLICY tenant_isolation ON "CandidateProcess"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));

ALTER TABLE "CandidateInquirer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CandidateInquirer" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "CandidateInquirer";
CREATE POLICY tenant_isolation ON "CandidateInquirer"
  USING ("lodgeId" = current_setting('app.current_lodge_id', true))
  WITH CHECK ("lodgeId" = current_setting('app.current_lodge_id', true));
