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
  ThreadChannel,
} from "discord.js";
import prisma from "../../db";
import { TrackedRole } from "@prisma/client";

/**
 * Función que ejecuta el proceso pesado de almacenar el histórico.
 * Retorna un objeto con la cantidad de registros creados y respuestas actualizadas.
 */

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
      // if (
      //   !channelFromGuild ||
      //   !channelFromGuild.isTextBased() ||
      //   !("messages" in channelFromGuild)
      // ) {
      //   await selectInteraction.reply({
      //     content:
      //       "El canal seleccionado no es un canal de texto o no se encontró.",
      //     ephemeral: true,
      //   });
      //   return;
      // }

      // // Asumimos que es un TextChannel.
      // const textChannel = channelFromGuild as TextChannel;

      // Confirmamos al usuario que el proceso se iniciará en segundo plano.
      await selectInteraction.update({
        content:
          "Proceso iniciado en segundo plano. Recibirás un DM al finalizar.",
        components: [],
      });

      // Ejecutamos el proceso pesado sin bloquear la ejecución del bot.
      setImmediate(async () => {
        try {
          const tempRoles = await prisma.trackedRole.findMany({
            where: { guildId: guild.id },
          });

          const trackedRoles = tempRoles.map(
            (role: TrackedRole) => role.roleId
          );

          //selectedChannelId
          await processChannel(guild, selectedChannelId, trackedRoles, true);
          await processChannel(guild, selectedChannelId, trackedRoles, false);

          // Obtenemos al usuario para enviarle el DM.
          const user: User = await interaction.client.users.fetch(
            interaction.user.id
          );
          await user.send(
            `Proceso finalizado en el canal **${channelFromGuild.name}**.`
          );
        } catch (error) {
          console.error("Error en proceso en background:", error);
          const user: User = await interaction.client.users.fetch(
            interaction.user.id
          );
          await user.send(
            `Ocurrió un error al procesar el histórico en el canal **${channelFromGuild.name}**.`
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

async function processChannel(
  guild: DiscordGuild,
  channelId: string,
  trackedRoles: string[],
  isFirstPass: boolean
) {
  try {
    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      console.error(`⚠️ Canal ${channelId} no encontrado en el servidor.`);
      return;
    }

    console.log(`🔍 Canal ${channelId} encontrado, tipo: ${channel.type}`);

    // Solo para la primera pasada obtenemos el lastStoredAt
    const trackedChannelRecord = await prisma.trackedChannel.findUnique({
      where: { channelId },
    });
    const lastStoredAt = isFirstPass
      ? trackedChannelRecord?.lastStoredAt ?? null
      : null;

    let newLastStoredAt: Date | null = null;

    if (channel.type === 0 || channel.type === 5) {
      newLastStoredAt = await processMessages(
        guild,
        channel as TextChannel | ThreadChannel,
        channelId,
        trackedRoles,
        isFirstPass,
        lastStoredAt
      );
    } else if (channel.type === 15) {
      console.log(`📌 Procesando foro: ${channel.name}`);
      for (const [_, thread] of (await channel.threads.fetchActive()).threads) {
        const threadLast = await processMessages(
          guild,
          thread as ThreadChannel,
          thread.id,
          trackedRoles,
          isFirstPass,
          lastStoredAt
        );
        if (threadLast && (!newLastStoredAt || threadLast > newLastStoredAt)) {
          newLastStoredAt = threadLast;
        }
      }
      for (const [_, thread] of (
        await channel.threads.fetchArchived({ limit: 50 })
      ).threads) {
        const threadLast = await processMessages(
          guild,
          thread as ThreadChannel,
          thread.id,
          trackedRoles,
          isFirstPass,
          lastStoredAt
        );
        if (threadLast && (!newLastStoredAt || threadLast > newLastStoredAt)) {
          newLastStoredAt = threadLast;
        }
      }
    } else {
      console.error(
        `⚠️ Canal ${channelId} encontrado pero NO es de texto, anuncios ni foro.`
      );
      return;
    }

    // Actualizamos el lastStoredAt en BD solo en la primera pasada.
    if (isFirstPass && newLastStoredAt) {
      await prisma.trackedChannel.update({
        where: { channelId },
        data: { lastStoredAt: newLastStoredAt },
      });
      console.log(
        `✅ Última fecha procesada para el canal ${channelId} actualizada a ${newLastStoredAt.toISOString()}`
      );
    }
  } catch (error) {
    console.error(`❌ Error procesando canal ${channelId}:`, error);
  }
}

async function processMessages(
  guild: DiscordGuild,
  channel: TextChannel | ThreadChannel,
  channelId: string,
  trackedRoles: string[],
  isFirstPass: boolean,
  lastStoredAt: Date | null
): Promise<Date | null> {
  console.log(`📥 Obteniendo mensajes de #${channel.name} (${channelId})...`);
  let lastMessageId: string | undefined;
  // Solo en primera pasada acumulamos el timestamp de los mensajes nuevos.
  let newLastStoredAt: Date | null = isFirstPass ? lastStoredAt : null;
  let stopFetching = false;
  const userMentionRegex = /<@!?(\d+)>/g;

  while (!stopFetching) {
    const messages = await channel.messages.fetch({
      limit: 100,
      before: lastMessageId,
    });
    if (messages.size === 0) break;

    // Solo en la primera pasada: si el mensaje más antiguo del lote es anterior o igual a lastStoredAt, detenemos.
    if (
      isFirstPass &&
      lastStoredAt &&
      messages.last() &&
      messages.last()!.createdAt <= lastStoredAt
    ) {
      stopFetching = true;
    }

    for (const msg of messages.values()) {
      // Solo en la primera pasada filtramos mensajes que ya fueron procesados.
      if (isFirstPass && lastStoredAt && msg.createdAt <= lastStoredAt) {
        stopFetching = true;
        break;
      }

      // Acumulamos el timestamp en la primera pasada para actualizar lastStoredAt.
      if (
        isFirstPass &&
        (!newLastStoredAt || msg.createdAt > newLastStoredAt)
      ) {
        newLastStoredAt = msg.createdAt;
      }

      if (isFirstPass) {
        // Primera pasada: registrar las menciones en el mensaje.
        let match;
        while ((match = userMentionRegex.exec(msg.content)) !== null) {
          const mentionedId = match[1];
          if (mentionedId === msg.author.id) continue;

          const member = await msg.guild?.members
            .fetch(mentionedId)
            .catch(() => null);
          if (member) {
            const roles = member.roles.cache.map((role) => role.id);
            if (roles.some((role) => trackedRoles.includes(role))) {
              try {
                await prisma.mentionRecord.upsert({
                  where: {
                    // Utilizamos la clave compuesta: messageId, channelId y guildId
                    messageId_channelId_guildId: {
                      messageId: msg.id,
                      channelId: channelId,
                      guildId: guild.id,
                    },
                  },
                  update: {},
                  create: {
                    guildId: guild.id,
                    channelId: channelId,
                    messageId: msg.id,
                    mentionedId: mentionedId,
                    authorId: msg.author.id,
                    mentionedName: member.user.tag,
                    authorName: msg.author.tag,
                    createdAt: msg.createdAt,
                  },
                });
                console.log(
                  `📥 Registrada mención de ${member.user.tag} en mensaje ${msg.id}`
                );
              } catch (error) {
                console.error("❌ Error al insertar mención:", error);
              }
            }
          }
        }
      } else {
        // Segunda pasada: actualizar las respuestas a las menciones.
        if (msg.reference?.messageId) {
          const referencedMessageId = msg.reference.messageId;
          const previousMention = await prisma.mentionRecord.findFirst({
            where: {
              messageId: referencedMessageId,
              mentionedId: msg.author.id,
              respondedAt: null,
            },
          });
          if (previousMention) {
            await prisma.mentionRecord.update({
              where: { id: previousMention.id },
              data: {
                respondedAt: msg.createdAt,
                closedResponseMessageId: msg.id,
              },
            });
            console.log(
              `✅ Mención en ${previousMention.messageId} respondida por ${msg.author.tag} en ${msg.id}`
            );
          }
        }
      }
    }

    lastMessageId = messages.last()?.id;
  }

  return newLastStoredAt;
}
