import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  ChatInputCommandInteraction,
  TextChannel,
  Message,
  User,
  ChannelType,
  ForumChannel,
  ThreadChannel,
  Collection,
} from "discord.js";
import prisma from "../../db";

type AuxMentions = {
  guildId: string;
  channelId: string;
  messageId: string;
  mentionedId: string;
  authorId: string;
  mentionedName: string;
  authorName: string;
  createdAt?: Date;
  respondedAt?: Date;
  threadId?: string;
};

export const command = {
  data: new SlashCommandBuilder()
    .setName("storechannelhistory")
    .setDescription(
      "Processes and stores mention history for a selected tracked channel (Text or Forum)."
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (interaction.guild) {
      await interaction.reply({
        content:
          "This command can only be used in a direct message (DM) with the bot.",
        ephemeral: true,
      });
      return;
    }

    const userContext = await prisma.userContext.findUnique({
      where: { userId: interaction.user.id },
    });
    if (!userContext) {
      await interaction.reply({
        content:
          "You don't have any server selected. Use `/setserver` to select one.",
        ephemeral: true,
      });
      return;
    }
    const guildId = userContext.guildId;

    const trackedChannels = await prisma.trackedChannel.findMany({
      where: { guildId },
      select: { channelId: true, name: true, channelType: true },
    });
    if (!trackedChannels || trackedChannels.length === 0) {
      await interaction.reply({
        content: "There are no tracked channels for the selected server.",
        ephemeral: true,
      });
      return;
    }

    const options = trackedChannels.map((tc) => ({
      label: `${tc.name} (${ChannelType[tc.channelType]})`,
      description: `ID: ${tc.channelId}`,
      value: tc.channelId,
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("trackedChannelsSelect")
      .setPlaceholder("Select a channel to store its mention history")
      .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu
    );

    const replyMessage = await interaction.reply({
      content: "Select a tracked channel to process its mention history:",
      components: [row],
      ephemeral: true,
      fetchReply: true,
    });

    try {
      const selectInteraction = await (
        replyMessage as any
      ).awaitMessageComponent({
        filter: (i: any) =>
          i.customId === "trackedChannelsSelect" &&
          i.user.id === interaction.user.id,
        componentType: ComponentType.StringSelect,
        time: 60000,
      });

      const selectedChannelId = selectInteraction.values[0];
      const guild = interaction.client.guilds.cache.get(guildId);

      if (!guild) {
        await selectInteraction.update({
          content: "The selected server could not be found.",
          components: [],
        });
        return;
      }

      const channelFromGuild = await guild.channels.fetch(selectedChannelId);

      const trackedChannelData = await prisma.trackedChannel.findUnique({
        where: { channelId: selectedChannelId },
      });

      if (!channelFromGuild || !trackedChannelData) {
        await selectInteraction.update({
          content: "The selected channel could not be found or is not tracked.",
          components: [],
        });
        return;
      }

      if (trackedChannelData.channelType === ChannelType.GuildText) {
        if (!(channelFromGuild instanceof TextChannel)) {
          await selectInteraction.update({
            content: `Error: Channel ${channelFromGuild.name} is tracked as Text but is not a TextChannel.`,
            components: [],
          });
          return;
        }
        await selectInteraction.update({
          content: `Background process started for Text channel **${channelFromGuild.name}**. You will receive a DM upon completion.`,
          components: [],
        });
        setImmediate(() =>
          processTextChannel(channelFromGuild, interaction.user)
        );
      } else if (trackedChannelData.channelType === ChannelType.GuildForum) {
        if (!(channelFromGuild instanceof ForumChannel)) {
          await selectInteraction.update({
            content: `Error: Channel ${channelFromGuild.name} is tracked as Forum but is not a ForumChannel.`,
            components: [],
          });
          return;
        }
        await selectInteraction.update({
          content: `Background process started for Forum channel **${channelFromGuild.name}**. This may take a while depending on the number of threads. You will receive a DM upon completion.`,
          components: [],
        });
        setImmediate(() =>
          processForumChannel(channelFromGuild, interaction.user)
        );
      } else {
        await selectInteraction.update({
          content: `Error: Unsupported channel type (${
            ChannelType[trackedChannelData.channelType]
          }) for channel **${channelFromGuild.name}**.`,
          components: [],
        });
        return;
      }
    } catch (error) {
      if ((error as Error).message.includes("time")) {
        await interaction.followUp({
          content: "No selection was made in time.",
          ephemeral: true,
        });
      } else {
        console.error(
          "Error during channel selection or processing initiation:",
          error
        );
        await interaction.followUp({
          content: "An error occurred while processing your request.",
          ephemeral: true,
        });
      }
    }
  },
};

async function processMessages(
  messages: Collection<string, Message>,
  guildId: string,
  channelId: string,
  trackedRoleIds: string[],
  mentionsMap: Map<string, AuxMentions>,
  threadId?: string
) {
  const userMentionRegex = /<@!?(\d+)>/g;
  const messagesArray = Array.from(messages.values()).reverse();

  for (const msg of messagesArray) {
    if (msg.author.bot) continue;

    if (msg.reference?.messageId) {
      const repliedMessageId = msg.reference.messageId;
      const targetMention = mentionsMap.get(repliedMessageId);
      if (
        targetMention &&
        targetMention.mentionedId === msg.author.id &&
        !targetMention.respondedAt
      ) {
        targetMention.respondedAt = msg.createdAt;
        mentionsMap.set(repliedMessageId, targetMention);
      }
    }

    userMentionRegex.lastIndex = 0;
    let match;
    while ((match = userMentionRegex.exec(msg.content)) !== null) {
      const mentionedUserId = match[1];
      if (mentionedUserId === msg.author.id || mentionsMap.has(msg.id))
        continue;

      try {
        const member = await msg.guild!.members.fetch(mentionedUserId);
        const memberHasTrackedRole = member.roles.cache.hasAny(
          ...trackedRoleIds
        );

        if (memberHasTrackedRole) {
          const mentionData: AuxMentions = {
            guildId: guildId,
            channelId: channelId,
            messageId: msg.id,
            mentionedId: mentionedUserId,
            authorId: msg.author.id,
            mentionedName: member.user.tag,
            authorName: msg.author.tag,
            createdAt: msg.createdAt,
            respondedAt: undefined,
          };
          if (threadId) {
            mentionData.threadId = threadId;
          }
          mentionsMap.set(msg.id, mentionData);
        }
      } catch (error) {
        continue;
      }
    }
  }
  return messagesArray.length > 0
    ? messagesArray[messages.size - 1].id
    : undefined;
}

async function saveMentions(
  mentionsMap: Map<string, AuxMentions>,
  identifier: string
) {
  if (mentionsMap.size === 0) {
    console.log(`No new mentions found to save for ${identifier}.`);
    return;
  }

  console.log(`Saving ${mentionsMap.size} mentions for ${identifier}...`);
  try {
    const createData = Array.from(mentionsMap.values());
    const mentionsToUpsert = createData.filter((m) => m.respondedAt);
    const mentionsToCreate = createData.filter((m) => !m.respondedAt);

    if (mentionsToCreate.length > 0) {
      await prisma.mentionRecord.createMany({
        data: mentionsToCreate,
        skipDuplicates: true,
      });
    }

    for (const mention of mentionsToUpsert) {
      await prisma.mentionRecord.upsert({
        where: {
          messageId_guildId: {
            messageId: mention.messageId,
            guildId: mention.guildId,
          },
        },
        update: { respondedAt: mention.respondedAt },
        create: mention,
      });
    }

    console.log(`✅ Mentions saved successfully for ${identifier}.`);
  } catch (error) {
    console.error(`❌ Error saving mentions for ${identifier}:`, error);
  }
}

async function processTextChannel(channel: TextChannel, user: User) {
  console.log(
    `Starting history processing for Text Channel: ${channel.name} (${channel.id})`
  );
  const mentionsMap = new Map<string, AuxMentions>();
  let messageCount = 0;
  let lastMessageId: string | undefined = "0";

  try {
    const trackedRoleIds = (
      await prisma.trackedRole.findMany({
        where: { guildId: channel.guild.id },
        select: { roleId: true },
      })
    ).map((role) => role.roleId);

    if (trackedRoleIds.length === 0) {
      console.warn(
        `No tracked roles found for guild ${channel.guild.id}. Skipping mention processing.`
      );
      await user.send(
        `⚠️ No tracked roles configured for server ${channel.guild.name}. Cannot process mentions in channel **${channel.name}**.`
      );
      return;
    }

    while (true) {
      const messages = await channel.messages.fetch({
        limit: 100,
        after: lastMessageId,
      });
      if (messages.size === 0) break;

      messageCount += messages.size;
      const newLastMessageId = await processMessages(
        messages,
        channel.guild.id,
        channel.id,
        trackedRoleIds,
        mentionsMap
      );

      if (!newLastMessageId) break;
      lastMessageId = newLastMessageId;

      if (messageCount % 500 === 0) {
        console.log(`Processed ${messageCount} messages in ${channel.name}...`);
      }
    }

    console.log(
      `✅ Finished fetching messages for ${channel.name}. Total: ${messageCount}.`
    );
    await saveMentions(mentionsMap, `Text Channel: ${channel.name}`);
    await user.send(
      `✅ Finished processing history for Text channel **${channel.name}**. Processed ${messageCount} messages.`
    );
  } catch (error) {
    console.error(`Error processing Text Channel ${channel.name}:`, error);
    await user.send(
      `❌ An error occurred while processing history for Text channel **${channel.name}**.`
    );
  }
}

async function processForumChannel(channel: ForumChannel, user: User) {
  console.log(
    `Starting history processing for Forum Channel: ${channel.name} (${channel.id})`
  );
  const mentionsMap = new Map<string, AuxMentions>();
  let totalMessageCount = 0;

  try {
    const trackedRoleIds = (
      await prisma.trackedRole.findMany({
        where: { guildId: channel.guild.id },
        select: { roleId: true },
      })
    ).map((role) => role.roleId);

    if (trackedRoleIds.length === 0) {
      console.warn(
        `No tracked roles found for guild ${channel.guild.id}. Skipping mention processing.`
      );
      await user.send(
        `⚠️ No tracked roles configured for server ${channel.guild.name}. Cannot process mentions in Forum **${channel.name}**.`
      );
      return;
    }

    const activeThreads = await channel.threads.fetchActive();

    console.log(
      `Found ${activeThreads.threads.size} active threads in ${channel.name}. Processing...`
    );

    for (const thread of activeThreads.threads.values()) {
      console.log(`-- Processing Thread: ${thread.name} (${thread.id}) --`);
      let threadMessageCount = 0;
      let lastMessageId: string | undefined = "0";

      await prisma.threads.upsert({
        where: { threadId: thread.id },
        update: { name: thread.name },
        create: {
          threadId: thread.id,
          name: thread.name,
          channelId: channel.id,
          createdAt: thread.createdAt || new Date(),
        },
      });

      try {
        while (true) {
          const messages = await thread.messages.fetch({
            limit: 100,
            after: lastMessageId,
          });
          if (messages.size === 0) break;

          threadMessageCount += messages.size;
          const newLastMessageId = await processMessages(
            messages,
            channel.guild.id,
            channel.id,
            trackedRoleIds,
            mentionsMap,
            thread.id
          );

          if (!newLastMessageId) break;
          lastMessageId = newLastMessageId;

          if (threadMessageCount % 500 === 0) {
            console.log(
              `   Processed ${threadMessageCount} messages in thread ${thread.name}...`
            );
          }
        }
        console.log(
          `   Finished fetching messages for thread ${thread.name}. Total: ${threadMessageCount}.`
        );
        totalMessageCount += threadMessageCount;
      } catch (threadError) {
        console.error(
          `Error processing messages in thread ${thread.name} (${thread.id}):`,
          threadError
        );
      }
    }

    console.log(
      `✅ Finished processing all active threads in ${channel.name}. Total messages: ${totalMessageCount}.`
    );
    await saveMentions(mentionsMap, `Forum Channel: ${channel.name}`);
    await user.send(
      `✅ Finished processing history for Forum channel **${channel.name}**. Processed ${activeThreads.threads.size} active threads and ${totalMessageCount} messages.`
    );
  } catch (error) {
    console.error(`Error processing Forum Channel ${channel.name}:`, error);
    await user.send(
      `❌ An error occurred while processing history for Forum channel **${channel.name}**.`
    );
  }
}
