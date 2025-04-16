import { Message, ChannelType, ThreadChannel } from "discord.js";
import prisma from "../db";

export const once = false;

export async function execute(message: Message) {
  try {
    // Ignore bot messages
    if (message.author.bot) return;

    // Ensure the message comes from a server
    if (!message.guild) return;

    // Send a message to a webhook
    const webhookUrl = process.env.WEBHOOK_URL;
    //Prueba 8

    if (webhookUrl) {
      const payload = {
        username: "DeltaKPI Bot",
        message
      };

      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        console.log("Message sent to webhook successfully.");
      } catch (error) {
        console.error("Failed to send message to webhook:", error);
      }
    } else {
      console.warn("WEBHOOK_URL is not defined. Skipping webhook notification.");
    }

    const guildId = message.guild.id;
    const isThread = message.channel.isThread();
    // Use parent channel ID if it's a thread, otherwise use the channel ID
    const baseChannelId = isThread
      ? message.channel.parentId
      : message.channel.id;

    // Ensure the base channel ID exists (parent ID can be null)
    if (!baseChannelId) {
      console.warn(
        `Could not determine base channel ID for message ${message.id} in channel ${message.channel.id}`
      );
      return;
    }

    // Check if the base channel is tracked
    const trackedChannel = await prisma.trackedChannel.findUnique({
      where: { channelId: baseChannelId },
      select: { channelId: true, channelType: true }, // Select type as well
    });

    // If the base channel is not tracked, ignore
    if (!trackedChannel) return;

    // --- Mention Handling ---
    // Only handle mentions if it's a Text channel OR a thread within a Forum channel
    if (
      trackedChannel.channelType === ChannelType.GuildText ||
      (trackedChannel.channelType === ChannelType.GuildForum && isThread)
    ) {
      await handleMentions(
        message,
        guildId,
        trackedChannel.channelId,
        isThread ? message.channel.id : undefined
      );
    }

    // --- Response Handling ---
    // Only handle responses if it's a Text channel OR a thread within a Forum channel
    if (
      trackedChannel.channelType === ChannelType.GuildText ||
      (trackedChannel.channelType === ChannelType.GuildForum && isThread)
    ) {
      await handleResponses(
        message,
        guildId,
        trackedChannel.channelId,
        isThread ? message.channel.id : undefined
      );
    }
  } catch (error) {
    console.error("Error in messageCreate event:", error);
  }
}

/**
 * Handles mentions in tracked channels (Text or Forum Threads)
 */
async function handleMentions(
  message: Message,
  guildId: string,
  baseChannelId: string,
  threadId?: string
) {
  // Check for mentions
  if (message.mentions.users.size === 0) return;

  // Fetch tracked roles for the guild
  const trackedRoles = await prisma.trackedRole.findMany({
    where: { guildId },
    select: { roleId: true },
  });
  const trackedRoleIds = trackedRoles.map((r) => r.roleId);

  if (trackedRoleIds.length === 0) return; // No roles to track mentions for

  for (const [userId, user] of message.mentions.users) {
    // Don't process self-mentions
    if (userId === message.author.id) continue;

    try {
      const member = await message.guild!.members.fetch(userId);
      const memberHasTrackedRole = member.roles.cache.hasAny(...trackedRoleIds);

      if (memberHasTrackedRole) {
        // --- Ensure Thread Exists in DB (if applicable) ---
        if (threadId) {
          try {
            // Attempt to fetch the thread channel object to get its name
            const threadChannel = message.channel as ThreadChannel;
            await prisma.threads.upsert({
              where: { threadId: threadId },
              update: { name: threadChannel.name }, // Update name in case it changed
              create: {
                threadId: threadId,
                name: threadChannel.name, // Use actual thread name
                channelId: baseChannelId, // Link to parent Forum/Text channel
                createdAt: threadChannel.createdAt || new Date(), // Use thread creation time
              },
            });
          } catch (threadUpsertError) {
            console.error(
              `Error upserting thread ${threadId} for channel ${baseChannelId}:`,
              threadUpsertError
            );
            // Decide if we should continue without linking the thread
            // For now, we'll log the error and continue, the mention will lack the thread link
            // You might want to handle this differently (e.g., skip the mention)
          }
        }
        // --- Upsert Mention Record --- (Now safe to link threadId)
        await prisma.mentionRecord.upsert({
          where: {
            messageId_guildId: {
              messageId: message.id,
              guildId: guildId,
            },
          },
          update: {
            mentionedName: member.user.tag,
            authorName: message.author.tag,
            threadId: threadId,
          },
          create: {
            guildId,
            channelId: baseChannelId,
            messageId: message.id,
            mentionedId: member.id,
            mentionedName: member.user.tag,
            authorId: message.author.id,
            authorName: message.author.tag,
            createdAt: message.createdAt,
            threadId: threadId,
          },
        });
        console.log(
          `Mention record created/updated for user ${user.tag} in ${
            threadId ? `thread ${threadId}` : `channel ${baseChannelId}`
          }`
        );
      }
    } catch (error) {
      console.warn(
        `Could not fetch member ${userId} or process mention in guild ${guildId}:`,
        error
      );
    }
  }
}

/**
 * Handles responses from mentioned users in tracked channels (Text or Forum Threads)
 */
async function handleResponses(
  message: Message,
  guildId: string,
  baseChannelId: string,
  threadId?: string
) {
  // Find the most recent *unanswered* mention *to the message author* in the *same context* (channel or thread)
  const mentionRecord = await prisma.mentionRecord.findFirst({
    where: {
      guildId,
      channelId: baseChannelId, // Match base channel
      threadId: threadId, // Match thread ID (will be null for text channels, matching correctly)
      mentionedId: message.author.id,
      respondedAt: null, // Only unanswered mentions
    },
    orderBy: {
      createdAt: "desc", // Get the most recent one
    },
  });

  if (!mentionRecord) return; // No pending mention for this user in this context

  // Update the record with the response time
  const respondedAt = message.createdAt; // Use message timestamp as response time

  await prisma.mentionRecord.update({
    where: { id: mentionRecord.id }, // Use the specific record ID
    data: {
      respondedAt,
    },
  });

  // Calculate response time for logging (optional)
  const responseTime =
    respondedAt.getTime() - mentionRecord.createdAt.getTime();

  console.log(
    `Mention record updated for ${message.author.tag} in ${
      threadId ? `thread ${threadId}` : `channel ${baseChannelId}`
    }. Response time: ${responseTime}ms`
  );
}
