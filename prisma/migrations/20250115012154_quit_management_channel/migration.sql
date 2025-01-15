/*
  Warnings:

  - You are about to drop the `ManagementChannel` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ManagementChannel" DROP CONSTRAINT "ManagementChannel_guildId_fkey";

-- DropTable
DROP TABLE "ManagementChannel";
