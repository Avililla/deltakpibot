-- CreateTable
CREATE TABLE "ManagementChannel" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagementChannel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManagementChannel_guildId_key" ON "ManagementChannel"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagementChannel_channelId_key" ON "ManagementChannel"("channelId");

-- AddForeignKey
ALTER TABLE "ManagementChannel" ADD CONSTRAINT "ManagementChannel_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;
