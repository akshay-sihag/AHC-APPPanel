/*
  Warnings:

  - Added the required column `appUserId` to the `weight_logs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "weight_logs" ADD COLUMN     "appUserId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "weight_logs_appUserId_idx" ON "weight_logs"("appUserId");

-- AddForeignKey
ALTER TABLE "weight_logs" ADD CONSTRAINT "weight_logs_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
