/*
  Warnings:

  - You are about to drop the column `guildId` on the `Threads` table. All the data in the column will be lost.
  - Made the column `channelId` on table `MentionRecord` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `channelId` to the `Threads` table without a default value. This is not possible if the table is not empty.
  - Added the required column `channelType` to the `TrackedChannel` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserCapability" AS ENUM ('CAN_MANAGE_GUILDS', 'CAN_VIEW_MENTOR_STATS');

-- DropForeignKey
ALTER TABLE "Threads" DROP CONSTRAINT "Threads_guildId_fkey";

-- AlterTable
ALTER TABLE "MentionRecord" ALTER COLUMN "channelId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Threads" DROP COLUMN "guildId",
ADD COLUMN     "channelId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "TrackedChannel" ADD COLUMN     "channelType" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Threads" ADD CONSTRAINT "Threads_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "TrackedChannel"("channelId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentionRecord" ADD CONSTRAINT "MentionRecord_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "TrackedChannel"("channelId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentionRecord" ADD CONSTRAINT "MentionRecord_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Threads"("threadId") ON DELETE CASCADE ON UPDATE CASCADE;
