-- AlterTable
ALTER TABLE "app_user" ADD COLUMN     "fcmToken" TEXT;

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "fcmProjectId" TEXT,
ADD COLUMN     "fcmServerKey" TEXT;
