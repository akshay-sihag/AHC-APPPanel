/*
  Warnings:

  - You are about to drop the column `secretKey` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `secretKeyEnabled` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "secretKey",
DROP COLUMN "secretKeyEnabled";

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL DEFAULT 'settings',
    "adminEmail" TEXT NOT NULL DEFAULT 'admin@alternatehealthclub.com',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "sessionTimeout" INTEGER NOT NULL DEFAULT 30,
    "requireStrongPassword" BOOLEAN NOT NULL DEFAULT true,
    "enableTwoFactor" BOOLEAN NOT NULL DEFAULT false,
    "woocommerceApiUrl" TEXT,
    "woocommerceApiKey" TEXT,
    "woocommerceApiSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsed" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secret_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "isLoginToken" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsed" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "secret_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "secret_tokens_userId_idx" ON "secret_tokens"("userId");

-- AddForeignKey
ALTER TABLE "secret_tokens" ADD CONSTRAINT "secret_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
