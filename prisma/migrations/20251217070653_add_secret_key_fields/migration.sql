-- AlterTable
ALTER TABLE "users" ADD COLUMN     "secretKey" TEXT,
ADD COLUMN     "secretKeyEnabled" BOOLEAN NOT NULL DEFAULT false;
