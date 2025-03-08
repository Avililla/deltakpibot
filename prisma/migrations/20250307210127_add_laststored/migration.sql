/*
  Warnings:

  - A unique constraint covering the columns `[messageId,guildId]` on the table `MentionRecord` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "MentionRecord_messageId_channelId_guildId_key";

-- AlterTable
ALTER TABLE "MentionRecord" ALTER COLUMN "channelId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "MentionRecord_messageId_guildId_key" ON "MentionRecord"("messageId", "guildId");
