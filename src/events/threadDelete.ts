import { ThreadChannel } from "discord.js";
import prisma from "../db";

export const once = false; // This event can occur multiple times

export async function execute(thread: ThreadChannel) {
  try {
    const threadId = thread.id;

    console.log(
      `Thread deletion event received for Thread ID: ${threadId} (Name: ${thread.name}, Parent Channel: ${thread.parentId})`
    );

    // Attempt to delete the thread record from the database
    // The cascade delete defined in the schema will handle associated MentionRecords
    await prisma.threads.delete({
      where: {
        threadId: threadId,
      },
    });

    console.log(
      `Successfully deleted thread record for Thread ID ${threadId} from the database via threadDelete event. Associated mentions were cascaded.`
    );
  } catch (error: any) {
    // Handle specific error codes, e.g., if the record was not found
    if (error.code === "P2025") {
      // Prisma's error code for "Record to delete not found."
      console.log(
        `Thread record for deleted Thread ID ${thread.id} not found in the database (threadDelete event). It might have been deleted previously or was never stored.`
      );
    } else {
      // Log other potential errors
      console.error(
        `Error processing threadDelete event for Thread ID ${thread.id}:`,
        error
      );
    }
  }
}
