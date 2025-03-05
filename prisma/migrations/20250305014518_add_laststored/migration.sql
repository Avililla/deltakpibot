/*
  Warnings:

  - A unique constraint covering the columns `[messageId,channelId,guildId]` on the table `MentionRecord` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "MentionRecord_messageId_channelId_guildId_key" ON "MentionRecord"("messageId", "channelId", "guildId");
