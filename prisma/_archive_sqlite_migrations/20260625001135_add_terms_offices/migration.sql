CREATE TABLE "Office" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lodgeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Office_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Term" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lodgeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Term_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "MemberOffice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MemberOffice_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MemberOffice_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MemberOffice_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MemberOffice_memberId_officeId_termId_key" ON "MemberOffice"("memberId", "officeId", "termId");

CREATE TABLE "CashClose" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lodgeId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "closedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalReceivables" REAL NOT NULL DEFAULT 0,
    "totalPayables" REAL NOT NULL DEFAULT 0,
    "totalPayments" REAL NOT NULL DEFAULT 0,
    "netBalance" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashClose_lodgeId_fkey" FOREIGN KEY ("lodgeId") REFERENCES "Lodge" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CashClose_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CashClose_lodgeId_termId_key" ON "CashClose"("lodgeId", "termId");
