import {
  ActionRowBuilder,
  ChannelType,
  Message,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from "discord.js";
import prisma from "../../db";
import { isUserAdminOfGuild } from "../../utils";

export default {
  name: "settrackedchannels",
  description:
    "Configura los canales para seguimiento en el servidor seleccionado.",
  async execute(message: Message) {
    if (message.guild) {
      return message.reply(
        "Este comando solo puede ejecutarse desde un chat privado."
      );
    }

    // Verificar que el usuario es administrador de al menos un servidor donde esté el bot
    const isAdmin = await isUserAdminOfGuild(message.client, message.author);
    if (!isAdmin) {
      return message.reply(
        "No puedes usar este comando porque no eres administrador de ningún servidor donde esté el bot."
      );
    }

    // Obtener el contexto del servidor para el usuario actual
    const userContext = await prisma.userContext.findUnique({
      where: { userId: message.author.id },
    });

    if (!userContext) {
      return message.reply(
        "No tienes ningún servidor seleccionado actualmente. Usa `!setserver <nombre del servidor>` para seleccionar uno."
      );
    }

    // Buscar información del servidor en el cliente del bot
    const guild = message.client.guilds.cache.get(userContext.guildId);

    if (!guild) {
      return message.reply(
        "No se pudo encontrar el servidor seleccionado. Verifica que el bot sigue estando en el servidor."
      );
    }

    // Filtrar los canales de texto disponibles
    const textChannels = guild.channels.cache
      .filter((channel) => channel.type === ChannelType.GuildText)
      .map((channel) => ({
        label: channel.name,
        value: channel.id,
      }));

    if (textChannels.length === 0) {
      return message.reply(
        "No hay canales de texto disponibles en este servidor para configurar."
      );
    }

    // Obtener los canales ya seleccionados
    const trackedChannels = await prisma.trackedChannel.findMany({
      where: { guildId: guild.id },
      select: { channelId: true },
    });

    const trackedChannelIds = trackedChannels.map((tc) => tc.channelId);

    // Crear un menú de selección
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("select-tracked-channels")
      .setPlaceholder("Selecciona los canales para seguimiento")
      .setMinValues(0)
      .setMaxValues(textChannels.length)
      .addOptions(
        textChannels.map((channel) => ({
          label: channel.label,
          value: channel.value,
          default: trackedChannelIds.includes(channel.value),
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu
    );

    // Enviar el menú de selección al usuario
    const sentMessage = await message.reply({
      content: `Selecciona los canales de texto para configurarlos como canales de seguimiento en **${guild.name}**:`,
      components: [row],
    });

    // Crear un colector de interacciones
    const filter = (interaction: any) =>
      interaction.user.id === message.author.id &&
      interaction.customId === "select-tracked-channels";

    const collector = sentMessage.createMessageComponentCollector({
      filter,
      time: 60000, // 1 minuto para responder
    });

    collector.on("collect", async (interaction) => {
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
        content: `Los canales seleccionados se han actualizado correctamente.`,
        ephemeral: true,
      });

      collector.stop();
    });

    collector.on("end", (collected) => {
      if (collected.size === 0) {
        message.reply("No seleccionaste ningún canal. El comando ha expirado.");
      }
    });
  },
};
