/*
  Warnings:

  - You are about to drop the column `tag` on the `blogs` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "blogs_tag_idx";

-- AlterTable
ALTER TABLE "blogs" DROP COLUMN "tag",
ADD COLUMN     "tags" TEXT[];
