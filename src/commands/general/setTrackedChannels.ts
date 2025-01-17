import {
  SlashCommandBuilder,
  InteractionContextType,
  Guild,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  Channel,
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
      .filter((channel: any) => channel.type === ChannelType.GuildText)
      .map((channel: any) => ({
        label: channel.name,
        value: channel.id,
      }));

    if (textChannels.length === 0) {
      return interaction.reply(
        "There are no text channels available in this server to configure."
      );
    }

    const trackedChannels = await prisma.trackedChannel.findMany({
      where: { guildId: guild.id },
      select: { channelId: true },
    });

    const trackedChannelIds = trackedChannels.map((tc) => tc.channelId);

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("select-tracked-channels")
      .setPlaceholder("Selecciona los canales para seguimiento")
      .setMinValues(0)
      .setMaxValues(textChannels.length)
      .addOptions(
        textChannels.map((channel: any) => ({
          label: channel.label,
          value: channel.value,
          default: trackedChannelIds.includes(channel.value),
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu
    );

    const sentMessage = await interaction.reply({
      content: `Select the text channels to configure them as tracking channels in **${guild.name}**:`,
      components: [row],
    });

    const filter = (interaction: any) =>
      interaction.user.id === interaction.user.id &&
      interaction.customId === "select-tracked-channels";

    const collector = sentMessage.createMessageComponentCollector({
      filter,
      time: 60000, // 1 minuto para responder
    });

    collector.on("collect", async (interaction: any) => {
      const selectedChannelIds = (interaction as StringSelectMenuInteraction)
        .values;

      // Canales a agregar
      const channelsToAdd = selectedChannelIds.filter(
        (id) => !trackedChannelIds.includes(id)
      );

      // Canales a eliminar
      const channelsToRemove = trackedChannelIds.filter(
        (id) => !selectedChannelIds.includes(id)
      );

      // Agregar nuevos canales
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

      // Eliminar canales que ya no están seleccionados
      for (const channelId of channelsToRemove) {
        await prisma.trackedChannel.deleteMany({
          where: { guildId: guild.id, channelId },
        });
      }

      await interaction.reply({
        content: "The channels have been configured successfully.",
        ephemeral: true,
      });

      collector.stop();
    });

    collector.on("end", (collected: any) => {
      if (collected.size === 0) {
        interaction.reply(
          "You did not select any channel. The command has expired."
        );
      }
    });
  },
};
