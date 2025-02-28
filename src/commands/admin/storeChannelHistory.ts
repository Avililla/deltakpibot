import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  ChatInputCommandInteraction,
  TextChannel,
  Message,
  Guild as DiscordGuild,
  User,
} from "discord.js";
import prisma from "../../db";

/**
 * Función que ejecuta el proceso pesado de almacenar el histórico.
 * Retorna un objeto con la cantidad de registros creados y respuestas actualizadas.
 */
async function processChannelHistory(
  guild: DiscordGuild,
  textChannel: TextChannel,
  guildId: string
): Promise<{ storedRecords: number; updatedRecords: number }> {
  let storedRecords = 0;
  let updatedRecords = 0;

  // Obtenemos los roles trackeados para este servidor (se usa en todos los mensajes)
  const trackedRoles = await prisma.trackedRole.findMany({
    where: { guildId },
    select: { roleId: true },
  });

  // Obtenemos el histórico completo de mensajes de forma paginada.
  let allMessages: Message[] = [];
  let lastId: string | undefined = undefined;

  while (true) {
    const fetchOptions: { limit: number; before?: string } = { limit: 100 };
    if (lastId) fetchOptions.before = lastId;
    const fetched = await textChannel.messages.fetch(fetchOptions);
    if (fetched.size === 0) break;
    allMessages.push(...fetched.values());
    lastId = fetched.last()?.id;
  }

  // Ordenamos los mensajes de forma ascendente (más antiguos primero).
  allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  console.log(
    `Histórico del canal ${textChannel.name} (ID: ${textChannel.id}):`
  );

  // Iteramos sobre cada mensaje para procesar menciones y respuestas.
  for (const message of allMessages) {
    console.log(
      `[${message.createdAt.toISOString()}] ${message.author.tag}: ${
        message.content
      }`
    );

    // 1. Procesamos las menciones (creación de registros)
    if (message.mentions.users.size > 0) {
      for (const [userId] of message.mentions.users) {
        // Intentamos obtener el miembro correspondiente al usuario mencionado.
        let member;
        try {
          member = await guild.members.fetch(userId);
        } catch (error) {
          console.warn(
            `No se encontró al usuario mencionado con ID ${userId} en el mensaje ${message.id}. Se ignora esta mención.`
          );
          continue; // Si no se encuentra el miembro, se ignora esta mención.
        }

        // Verificamos si el miembro tiene alguno de los roles trackeados.
        const matchingRole = trackedRoles.find((role) =>
          member.roles.cache.has(role.roleId)
        );
        if (!matchingRole) {
          console.warn(
            `El usuario ${member.user.username} no posee ningún rol trackeado en el mensaje ${message.id}. Se ignora esta mención.`
          );
          continue; // Si el miembro no tiene roles trackeados, se ignora la mención.
        }

        // Verificamos si ya existe un registro para esta mención.
        const existingRecord = await prisma.mentionRecord.findFirst({
          where: {
            guildId,
            channelId: message.channel.id,
            messageId: message.id,
            roleId: matchingRole.roleId,
            mentionedId: member.id,
            authorId: message.author.id,
            createdAt: message.createdAt,
          },
        });

        if (existingRecord) {
          console.log(
            `El registro de mención ya existe para el mensaje ${message.id} y usuario ${member.user.username}.`
          );
          continue;
        }

        // Creamos el registro de mención en la base de datos.
        await prisma.mentionRecord.create({
          data: {
            guildId,
            channelId: message.channel.id,
            roleId: matchingRole.roleId,
            messageId: message.id,
            mentionedId: member.id,
            mentionedName: member.user.username,
            authorId: message.author.id,
            authorName: message.author.username,
            createdAt: message.createdAt,
          },
        });
        storedRecords++;
        console.log(
          `Registro de mención creado para ${member.user.username} en el mensaje ${message.id}`
        );
      }
    }

    // 2. Verificamos si el mensaje es una respuesta a una mención pendiente.
    try {
      const pendingMention = await prisma.mentionRecord.findFirst({
        where: {
          guildId,
          channelId: message.channel.id,
          mentionedId: message.author.id,
          respondedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });
      if (pendingMention) {
        await prisma.mentionRecord.update({
          where: { id: pendingMention.id },
          data: { respondedAt: message.createdAt },
        });
        updatedRecords++;
        console.log(
          `Registro de mención actualizado para ${message.author.username} en el mensaje ${message.id}`
        );
      }
    } catch (error) {
      console.error(
        `Error actualizando la respuesta en el mensaje ${message.id}:`,
        error
      );
    }
  }

  return { storedRecords, updatedRecords };
}

export const command = {
  data: new SlashCommandBuilder()
    .setName("storechannelhistory")
    .setDescription("Store channel history."),

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
      .setPlaceholder("Selecciona un canal para almacenar su histórico")
      .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu
    );

    // Enviamos el mensaje con el menú desplegable.
    const replyMessage = await interaction.reply({
      content:
        "Selecciona un canal trackeado para almacenar el histórico de menciones:",
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

      // Confirmamos al usuario que el proceso se iniciará en segundo plano.
      await selectInteraction.update({
        content:
          "Proceso iniciado en segundo plano. Recibirás un DM al finalizar.",
        components: [],
      });

      // Ejecutamos el proceso pesado sin bloquear la ejecución del bot.
      setImmediate(async () => {
        try {
          const result = await processChannelHistory(
            guild,
            textChannel,
            guildId
          );
          // Obtenemos al usuario para enviarle el DM.
          const user: User = await interaction.client.users.fetch(
            interaction.user.id
          );
          await user.send(
            `Proceso finalizado en el canal **${textChannel.name}**.\nRegistros creados: ${result.storedRecords}\nRespuestas actualizadas: ${result.updatedRecords}.`
          );
        } catch (error) {
          console.error("Error en proceso en background:", error);
          const user: User = await interaction.client.users.fetch(
            interaction.user.id
          );
          await user.send(
            `Ocurrió un error al procesar el histórico en el canal **${textChannel.name}**.`
          );
        }
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
