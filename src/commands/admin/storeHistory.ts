import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  ChatInputCommandInteraction,
  TextChannel,
} from "discord.js";
import prisma from "../../db";

export const command = {
  data: new SlashCommandBuilder()
    .setName("storehistory")
    .setDescription(
      "Muestra un menú desplegable con los canales trackeados para el servidor seleccionado."
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    // Este comando se usará solo en DM.
    if (interaction.guild) {
      await interaction.reply({
        content:
          "Este comando solo se puede usar en un mensaje directo (DM) con el bot.",
        ephemeral: true,
      });
      return;
    }

    // Obtenemos el contexto del usuario (el servidor actualmente seleccionado)
    const userContext = await prisma.userContext.findUnique({
      where: { userId: interaction.user.id },
    });
    if (!userContext) {
      await interaction.reply(
        "No tienes ningún servidor seleccionado. Usa `/setserver <nombre del servidor>` para seleccionar uno."
      );
      return;
    }
    const guildId = userContext.guildId;

    // Obtenemos los canales trackeados para el servidor seleccionado
    const trackedChannels = await prisma.trackedChannel.findMany({
      where: { guildId },
    });

    if (!trackedChannels || trackedChannels.length === 0) {
      await interaction.reply({
        content: "No hay canales trackeados para el servidor seleccionado.",
        ephemeral: true,
      });
      return;
    }

    // Creamos las opciones para el menú desplegable a partir de los canales trackeados.
    const options = trackedChannels.map((tc) => ({
      label: tc.name,
      description: `ID: ${tc.channelId}`,
      value: tc.channelId,
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("trackedChannelsSelect")
      .setPlaceholder("Selecciona un canal para mostrar su histórico")
      .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu
    );

    // Enviamos el mensaje con el menú desplegable.
    const replyMessage = await interaction.reply({
      content:
        "Selecciona un canal trackeado para mostrar su histórico (desde el día 1):",
      components: [row],
      ephemeral: true,
      fetchReply: true,
    });

    try {
      // Esperamos a que el usuario seleccione una opción (tiempo límite: 60 segundos)
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

      // Obtenemos el guild y luego el canal seleccionado del cache.
      const guild = interaction.client.guilds.cache.get(guildId);
      if (!guild) {
        await selectInteraction.reply({
          content: "El servidor seleccionado no se encontró.",
          ephemeral: true,
        });
        return;
      }

      const channelFromGuild = guild.channels.cache.get(selectedChannelId);
      // Verificamos que el canal sea de texto y que disponga de la propiedad 'messages'
      if (
        !channelFromGuild ||
        !channelFromGuild.isTextBased() ||
        !("messages" in channelFromGuild)
      ) {
        await selectInteraction.reply({
          content:
            "El canal seleccionado no es un canal de texto o no se encontró.",
          ephemeral: true,
        });
        return;
      }

      // Asumimos que es un TextChannel.
      const textChannel = channelFromGuild as TextChannel;

      // Obtenemos el histórico completo de mensajes de forma paginada.
      let allMessages = [];
      let lastId: string | undefined = undefined;

      while (true) {
        const options: { limit: number; before?: string } = { limit: 100 };
        if (lastId) options.before = lastId;
        const fetched = await textChannel.messages.fetch(options);
        if (fetched.size === 0) break;
        allMessages.push(...fetched.values());
        lastId = fetched.last()?.id;
      }

      // Ordenamos los mensajes de forma ascendente (más antiguos primero).
      allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

      // Mostramos el histórico en la consola.
      console.log(
        `Histórico del canal ${textChannel.name} (ID: ${selectedChannelId}):`
      );
      for (const message of allMessages) {
        console.log(
          `[${message.createdAt.toISOString()}] ${message.author.tag}: ${
            message.content
          }`
        );
      }

      // Confirmamos al usuario que se ha mostrado el histórico.
      await selectInteraction.update({
        content: `✅ Se ha mostrado en la consola el histórico del canal **${textChannel.name}**.`,
        components: [],
      });
    } catch (error) {
      console.error(
        "No se realizó ninguna selección o ocurrió un error:",
        error
      );
      await interaction.followUp({
        content: "No se realizó ninguna selección a tiempo.",
        ephemeral: true,
      });
    }
  },
};
