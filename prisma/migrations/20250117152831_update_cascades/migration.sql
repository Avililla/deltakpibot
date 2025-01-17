-- DropForeignKey
ALTER TABLE "MentionRecord" DROP CONSTRAINT "MentionRecord_guildId_fkey";

-- DropForeignKey
ALTER TABLE "TrackedChannel" DROP CONSTRAINT "TrackedChannel_guildId_fkey";

-- DropForeignKey
ALTER TABLE "TrackedRole" DROP CONSTRAINT "TrackedRole_guildId_fkey";

-- AddForeignKey
ALTER TABLE "TrackedChannel" ADD CONSTRAINT "TrackedChannel_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedRole" ADD CONSTRAINT "TrackedRole_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentionRecord" ADD CONSTRAINT "MentionRecord_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserContext" ADD CONSTRAINT "UserContext_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;
