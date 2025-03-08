import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  ChatInputCommandInteraction,
  TextChannel,
  Message,
  User,
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
};

export const command = {
  data: new SlashCommandBuilder()
    .setName("storechannelhistory")
    .setDescription("Store channel history."),

  async execute(interaction: ChatInputCommandInteraction) {
    if (interaction.guild) {
      await interaction.reply({
        content:
          "Este comando solo se puede usar en un mensaje directo (DM) con el bot.",
        ephemeral: true,
      });
      return;
    }

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

    const replyMessage = await interaction.reply({
      content:
        "Selecciona un canal trackeado para almacenar el histórico de menciones:",
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
        await selectInteraction.reply({
          content: "El servidor seleccionado no se encontró.",
          ephemeral: true,
        });
        return;
      }

      const channelFromGuild = guild.channels.cache.get(selectedChannelId);

      if (!channelFromGuild || !(channelFromGuild instanceof TextChannel)) {
        await selectInteraction.reply({
          content:
            "Actualmente solo se procesan los canales te texto por problemas tecnicos y de rendimiento.",
          ephemeral: true,
        });
        return;
      }

      await selectInteraction.update({
        content:
          "Proceso iniciado en segundo plano. Recibirás un DM al finalizar.",
        components: [],
      });

      setImmediate(async () => {
        try {
          await processChannel(channelFromGuild);
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

// ✅ Función para procesar mensajes en un canal de texto normal (sin hilos)
async function processChannel(channel: TextChannel) {
  if (!channel) {
    console.error("Channel not found or is null.");
    return;
  }

  const mentions = new Map<string, AuxMentions>();

  const trackedRoles = (
    await prisma.trackedRole.findMany({
      where: { guildId: channel.guild.id },
      select: { roleId: true },
    })
  ).map((role) => role.roleId);

  const userMentionRegex = /<@!?(\d+)>/g;
  let messageCount = 0;
  const memoryThresholdMB = 50;

  const firstBatch = await channel.messages.fetch({ limit: 1, after: "0" });
  let lastMessageId: string | undefined = firstBatch.first()?.id;
  if (!lastMessageId) {
    console.error("No messages found in channel.");
    return;
  }

  while (true) {
    const messages = await channel.messages.fetch({
      limit: 100,
      after: lastMessageId,
    });
    if (messages.size === 0) break;

    const messagesArray: Message[] = Array.from(messages.values()).reverse();

    for (const msg of messagesArray) {
      messageCount++;

      if (msg.reference?.messageId) {
        const repliedMessageId = msg.reference.messageId;
        const targetMention = mentions.get(repliedMessageId);
        if (targetMention && !targetMention.respondedAt) {
          targetMention.respondedAt = msg.createdAt;
          mentions.set(repliedMessageId, targetMention);
        }
      }

      userMentionRegex.lastIndex = 0;
      let match;
      while ((match = userMentionRegex.exec(msg.content)) !== null) {
        const mentionedId = match[1];
        if (mentionedId === msg.author.id) continue;

        let member = channel.guild.members.cache.get(mentionedId);
        if (!member) {
          try {
            member = await channel.guild.members.fetch(mentionedId);
          } catch (error) {
            continue;
          }
        }
        const roles = member.roles.cache.map((role) => role.id);
        if (roles.some((role) => trackedRoles.includes(role))) {
          mentions.set(msg.id, {
            guildId: channel.guild.id,
            channelId: channel.id,
            messageId: msg.id,
            mentionedId,
            authorId: msg.author.id,
            mentionedName: member.user.tag,
            authorName: msg.author.tag,
            createdAt: msg.createdAt,
            respondedAt: undefined,
          });
        }
      }
    }
    lastMessageId = messagesArray[messagesArray.length - 1].id;
  }

  console.log(`✅ ${messageCount} mensajes cargados en ${channel.name}.`);

  if (mentions.size > 0) {
    console.log(
      `📥 Guardando menciones finales en la BD (${mentions.size})...`
    );
    try {
      await prisma.mentionRecord.createMany({
        data: Array.from(mentions.values()),
        skipDuplicates: true,
      });
      console.log("✅ Menciones finales guardadas correctamente.");
    } catch (error) {
      console.error("❌ Error al guardar las menciones finales:", error);
    }
  }
}
