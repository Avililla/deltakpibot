import { SlashCommandBuilder } from "discord.js";
import prisma from "../../db";

export const command = {
  data: new SlashCommandBuilder()
    .setName("settrackedchannel")
    .setDescription("Add or remove a tracked channel by ID.")
    .addStringOption((option) =>
      option
        .setName("channel_id")
        .setDescription("The ID of the channel to track or untrack.")
        .setRequired(true)
    ),

  async execute(interaction: any) {
    if (interaction.guild) {
      await interaction.reply(
        "This command can only be used in a direct message with the bot."
      );
      return;
    }

    const userContext = await prisma.userContext.findUnique({
      where: { userId: interaction.user.id },
    });

    if (!userContext) {
      return interaction.reply(
        "You don't have any server selected. Use `/setserver <server name>` to select one."
      );
    }

    const guildId = userContext.guildId;
    const channelId = interaction.options.getString("channel_id");

    const guild = interaction.client.guilds.cache.get(guildId);
    if (!guild) {
      return interaction.reply({
        content: "The selected server could not be found.",
        ephemeral: true,
      });
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      return interaction.reply({
        content: `The channel with ID ${channelId} was not found in this server.`,
        ephemeral: true,
      });
    }

    const existingChannel = await prisma.trackedChannel.findFirst({
      where: { guildId, channelId },
    });

    if (existingChannel) {
      await prisma.trackedChannel.deleteMany({
        where: { guildId, channelId },
      });
      return interaction.reply({
        content: `✅ The channel <#${channelId}> has been **removed** from tracking.`,
        ephemeral: true,
      });
    } else {
      await prisma.trackedChannel.create({
        data: {
          channelId,
          guildId: guild.id,
          name: channel.name,
        },
      });
      return interaction.reply({
        content: `✅ The channel <#${channelId}> has been **added** for tracking.`,
        ephemeral: true,
      });
    }
  },
};
