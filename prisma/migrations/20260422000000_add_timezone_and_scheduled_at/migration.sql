-- AlterTable
ALTER TABLE "app_user" ADD COLUMN "timezone" TEXT;

-- AlterTable
ALTER TABLE "scheduled_notifications" ADD COLUMN "scheduledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "scheduled_notifications_scheduledAt_idx" ON "scheduled_notifications"("scheduledAt");
