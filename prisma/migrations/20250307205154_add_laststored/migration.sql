-- AlterTable
ALTER TABLE "MentionRecord" ADD COLUMN     "threadId" TEXT;

-- CreateTable
CREATE TABLE "Threads" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Threads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Threads_threadId_key" ON "Threads"("threadId");

-- AddForeignKey
ALTER TABLE "Threads" ADD CONSTRAINT "Threads_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;
