-- CreateTable
CREATE TABLE "weight_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "userName" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weight" DOUBLE PRECISION NOT NULL,
    "previousWeight" DOUBLE PRECISION,
    "change" DOUBLE PRECISION,
    "changeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weight_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "weight_logs_userId_idx" ON "weight_logs"("userId");

-- CreateIndex
CREATE INDEX "weight_logs_userEmail_idx" ON "weight_logs"("userEmail");

-- CreateIndex
CREATE INDEX "weight_logs_date_idx" ON "weight_logs"("date");
