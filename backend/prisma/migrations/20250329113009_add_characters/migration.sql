/*
  Warnings:

  - A unique constraint covering the columns `[storyId,name]` on the table `Character` will be added. If there are existing duplicate values, this will fail.
  - Made the column `storyId` on table `Character` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Character" DROP CONSTRAINT "Character_storyId_fkey";

-- DropIndex
DROP INDEX "Character_name_key";

-- AlterTable
ALTER TABLE "Character" ALTER COLUMN "background" SET DEFAULT '',
ALTER COLUMN "personality" SET DEFAULT '',
ALTER COLUMN "storyId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Character_storyId_idx" ON "Character"("storyId");

-- CreateIndex
CREATE UNIQUE INDEX "Character_storyId_name_key" ON "Character"("storyId", "name");

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
