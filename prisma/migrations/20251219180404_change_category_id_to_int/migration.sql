/*
  Warnings:

  - The primary key for the `medicine_categories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `medicine_categories` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `categoryId` on the `medicines` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "medicines" DROP CONSTRAINT "medicines_categoryId_fkey";

-- AlterTable
ALTER TABLE "medicine_categories" DROP CONSTRAINT "medicine_categories_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "medicine_categories_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "medicines" DROP COLUMN "categoryId",
ADD COLUMN     "categoryId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "medicines_categoryId_idx" ON "medicines"("categoryId");

-- AddForeignKey
ALTER TABLE "medicines" ADD CONSTRAINT "medicines_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "medicine_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
