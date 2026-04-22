-- CreateTable
CREATE TABLE "medication_logs" (
    "id" TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "medicineId" TEXT,
    "medicineName" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medication_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "medication_logs_appUserId_idx" ON "medication_logs"("appUserId");

-- CreateIndex
CREATE INDEX "medication_logs_takenAt_idx" ON "medication_logs"("takenAt");

-- AddForeignKey
ALTER TABLE "medication_logs" ADD CONSTRAINT "medication_logs_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

