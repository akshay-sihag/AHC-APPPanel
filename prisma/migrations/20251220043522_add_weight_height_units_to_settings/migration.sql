-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "heightUnit" TEXT NOT NULL DEFAULT 'inches',
ADD COLUMN     "weightUnit" TEXT NOT NULL DEFAULT 'lbs';
