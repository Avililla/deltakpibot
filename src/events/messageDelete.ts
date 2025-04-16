import { Message, PartialMessage } from "discord.js";
import prisma from "../db";

export const once = false;

export async function execute(message: Message | PartialMessage) {
  try {
    // Ensure we have message ID and Guild ID (needed for lookup)
    if (!message.id) {
      console.warn("Deleted message missing ID, cannot process.");
      return;
    }
    if (!message.guildId) {
      console.warn(
        `Deleted message ${message.id} missing guildId, cannot process.`
      );
      return;
    }

    const messageId = message.id;
    const guildId = message.guildId;
    let deletedMentionThreadId: string | null = null;

    // --- Delete the Mention Record & Check if it was in a Thread ---
    try {
      // Find the mention first to get its details (like threadId)
      // Use the composite key for lookup
      const mentionToDelete = await prisma.mentionRecord.findUnique({
        where: {
          messageId_guildId: { messageId: messageId, guildId: guildId },
        },
        select: { id: true, threadId: true }, // Select primary key and threadId
      });

      if (mentionToDelete) {
        deletedMentionThreadId = mentionToDelete.threadId; // Store threadId if it existed

        // Delete the specific mention record by its unique ID (more specific than deleteMany)
        await prisma.mentionRecord.delete({
          where: { id: mentionToDelete.id },
        });
        console.log(
          `Deleted mention record (ID: ${mentionToDelete.id}) associated with deleted message ${messageId}.`
        );
      } else {
        // If no record found matching messageId/guildId, log and exit
        // console.log(`No mention record found for deleted message ${messageId} in guild ${guildId}.`);
        return;
      }
    } catch (error: any) {
      // Handle potential errors during find/delete, e.g., concurrent deletion
      if (error.code === "P2025") {
        // Prisma code for RecordNotFound
        console.log(
          `Mention record for message ${messageId} in guild ${guildId} likely already deleted.`
        );
        // Even if mention was already gone, the thread might still need cleanup check
        // We need to know the threadId if possible. Can we get it from the message? Risky.
        // Let's assume if the mention is gone, we can't reliably check the thread based on this message.
        return;
      } else {
        console.error(
          `Error finding/deleting mention record for message ${messageId} in guild ${guildId}:`,
          error
        );
        return; // Stop processing if we couldn't confirm mention deletion state
      }
    }

    // --- Check if Thread needs Cleanup (only if the deleted mention was in one) ---
    if (deletedMentionThreadId) {
      console.log(
        `Mention deleted was in thread ${deletedMentionThreadId}. Checking remaining mentions...`
      );
      try {
        // Count remaining mentions in the same thread
        const remainingMentionsCount = await prisma.mentionRecord.count({
          where: { threadId: deletedMentionThreadId },
        });

        console.log(
          `Remaining mentions in thread ${deletedMentionThreadId}: ${remainingMentionsCount}`
        );

        // If no mentions are left in this thread, delete the thread record
        if (remainingMentionsCount === 0) {
          console.log(
            `Last mention in thread ${deletedMentionThreadId} deleted. Attempting to delete thread record...`
          );
          try {
            await prisma.threads.delete({
              where: { threadId: deletedMentionThreadId },
            });
            console.log(
              `Successfully deleted empty thread record ${deletedMentionThreadId} via messageDelete cleanup.`
            );
          } catch (threadDeleteError: any) {
            // Handle race condition: thread might have been deleted by threadDelete event already
            if (threadDeleteError.code === "P2025") {
              console.log(
                `Thread record ${deletedMentionThreadId} not found during cleanup. Likely already deleted (e.g., by threadDelete event).`
              );
            } else {
              console.error(
                `Error deleting empty thread record ${deletedMentionThreadId} during cleanup:`,
                threadDeleteError
              );
            }
          }
        }
      } catch (countError) {
        console.error(
          `Error counting remaining mentions in thread ${deletedMentionThreadId}:`,
          countError
        );
      }
    }
  } catch (error) {
    // Catch any other unexpected errors during the process
    console.error("General error in messageDelete event:", error);
  }
}
