import {
  SlashCommandBuilder,
  InteractionContextType,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  StringSelectMenuInteraction,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  Guild,
  ChannelType,
} from "discord.js";
import { getOwnedGuilds } from "../../utils";
import prisma from "../../db";

export const command = {
  data: new SlashCommandBuilder()
    .setName("settrackedchannels")
    .setDescription("Set tracked channels for the selected server.")
    .setContexts(InteractionContextType.BotDM),

  async execute(interaction: any) {
    if (interaction.guild) {
      await interaction.reply(
        "This command can only be used in a direct message with the bot."
      );
      return;
    }

    const ownedGuilds = await getOwnedGuilds(
      interaction.client,
      interaction.user
    );
    if (ownedGuilds.length === 0) {
      await interaction.reply(
        "You are not the owner of any server where I am present."
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

    const guild = interaction.client.guilds.cache.get(userContext.guildId);
    if (!guild) {
      return interaction.reply(
        "The selected server could not be found. Make sure the bot is still in the server."
      );
    }

    const textChannels = guild.channels.cache
      .filter((channel) => channel.type === ChannelType.GuildText)
      .map((channel) => ({
        label: channel.name,
        value: channel.id,
      }));

    const trackedChannels = await prisma.trackedChannel.findMany({
      where: { guildId: guild.id },
      select: { channelId: true },
    });

    const trackedChannelIds = trackedChannels.map((tc) => tc.channelId);

    let page = 0;
    const pageSize = 10;

    const generateSelectMenu = () => {
      const options = textChannels
        .slice(page * pageSize, (page + 1) * pageSize)
        .map((channel) => ({
          label: channel.label,
          value: channel.value,
          default: trackedChannelIds.includes(channel.value),
        }));

      return new StringSelectMenuBuilder()
        .setCustomId("select-tracked-channels")
        .setPlaceholder("Select channels to track")
        .setMinValues(0)
        .setMaxValues(options.length)
        .addOptions(options);
    };

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      generateSelectMenu()
    );

    const prevButton = new ButtonBuilder()
      .setCustomId("prev-page")
      .setLabel("⬅️ Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0);

    const nextButton = new ButtonBuilder()
      .setCustomId("next-page")
      .setLabel("Next ➡️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled((page + 1) * pageSize >= textChannels.length);

    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      prevButton,
      nextButton
    );

    const message = await interaction.reply({
      content: `Select text channels to track in **${guild.name}**:`,
      components: [row, buttonRow],
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000,
    });

    collector.on("collect", async (i: StringSelectMenuInteraction) => {
      if (i.user.id !== interaction.user.id) return;

      const selectedChannelIds = i.values;
      const channelsToAdd = selectedChannelIds.filter(
        (id) => !trackedChannelIds.includes(id)
      );
      const channelsToRemove = trackedChannelIds.filter(
        (id) => !selectedChannelIds.includes(id)
      );

      // Add new channels
      for (const channelId of channelsToAdd) {
        const channel = guild.channels.cache.get(channelId);
        if (channel) {
          await prisma.trackedChannel.create({
            data: {
              channelId,
              guildId: guild.id,
              name: channel.name,
            },
          });
        }
      }

      // Remove unselected channels
      for (const channelId of channelsToRemove) {
        await prisma.trackedChannel.deleteMany({
          where: { guildId: guild.id, channelId },
        });
      }

      await i.reply({
        content: "Channels have been updated successfully.",
        ephemeral: true,
      });

      collector.stop();
    });

    const buttonCollector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
    });

    buttonCollector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) return;

      if (i.customId === "prev-page" && page > 0) {
        page--;
      } else if (
        i.customId === "next-page" &&
        (page + 1) * pageSize < textChannels.length
      ) {
        page++;
      }

      const newRow =
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          generateSelectMenu()
        );

      const newPrevButton = new ButtonBuilder()
        .setCustomId("prev-page")
        .setLabel("⬅️ Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0);

      const newNextButton = new ButtonBuilder()
        .setCustomId("next-page")
        .setLabel("Next ➡️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled((page + 1) * pageSize >= textChannels.length);

      const newButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        newPrevButton,
        newNextButton
      );

      await i.update({
        content: `Select text channels to track in **${guild.name}**:`,
        components: [newRow, newButtonRow],
      });
    });
  },
};
