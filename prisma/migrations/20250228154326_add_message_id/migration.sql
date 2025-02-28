/*
  Warnings:

  - Added the required column `messageId` to the `MentionRecord` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MentionRecord" ADD COLUMN     "messageId" TEXT NOT NULL;
