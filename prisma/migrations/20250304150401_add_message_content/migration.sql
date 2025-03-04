/*
  Warnings:

  - You are about to drop the column `roleId` on the `MentionRecord` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MentionRecord" DROP COLUMN "roleId",
ADD COLUMN     "closedResponseMessageId" TEXT;
