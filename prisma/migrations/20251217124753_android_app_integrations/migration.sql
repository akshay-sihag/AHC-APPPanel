-- CreateTable
CREATE TABLE "app_user" (
    "id" TEXT NOT NULL,
    "wpUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "displayName" TEXT,
    "phone" TEXT,
    "age" INTEGER,
    "height" TEXT,
    "weight" TEXT,
    "goal" TEXT,
    "initialWeight" TEXT,
    "weightSet" BOOLEAN NOT NULL DEFAULT false,
    "tasksToday" INTEGER NOT NULL DEFAULT 0,
    "totalWorkouts" INTEGER NOT NULL DEFAULT 0,
    "totalCalories" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "loginCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_user_wpUserId_key" ON "app_user"("wpUserId");

-- CreateIndex
CREATE INDEX "app_user_email_idx" ON "app_user"("email");

-- CreateIndex
CREATE INDEX "app_user_wpUserId_idx" ON "app_user"("wpUserId");
