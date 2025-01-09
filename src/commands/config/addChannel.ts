import { Message } from "discord.js";
import prisma from "../../db";

export default {
  name: "addchannel",
  description: "Añade un canal para seguimiento (intensivo o no intensivo).",
  async execute(message: Message, args: string[]) {
    // Verificar si el mensaje proviene de un servidor
    if (!message.guild) {
      return message.reply(
        "Este comando solo puede ejecutarse en un servidor."
      );
    }

    // Verificar permisos del usuario
    if (!message.member?.permissions.has("Administrator")) {
      return message.reply(
        "No tienes permisos para usar este comando. Debes ser administrador."
      );
    }

    // Verificar que se mencione un canal
    const channelMention = args[0];
    if (
      !channelMention ||
      !channelMention.startsWith("<#") ||
      !channelMention.endsWith(">")
    ) {
      return message.reply(
        "Por favor menciona un canal válido. Ejemplo: `!addChannel #canal [intensivo/no-intensivo]`"
      );
    }

    // Extraer el ID del canal mencionado
    const channelId = channelMention.slice(2, -1);

    // Verificar el tipo de seguimiento (intensivo o no intensivo)
    const trackingType = args[1]?.toLowerCase();
    if (trackingType !== "intensivo" && trackingType !== "no-intensivo") {
      return message.reply(
        "Por favor especifica el tipo de seguimiento: `intensivo` o `no-intensivo`. Ejemplo: `!addChannel #canal intensivo`"
      );
    }

    // Verificar si el canal existe en el servidor
    const channel = message.guild.channels.cache.get(channelId);
    if (!channel || channel.type !== 0) {
      // `0` es el tipo de texto en Discord.js v14
      return message.reply(
        "El canal mencionado no existe o no es un canal de texto."
      );
    }

    try {
      // Guardar el canal en la base de datos
      await prisma.trackedChannel.upsert({
        where: { guildId_channelId: { guildId: message.guild.id, channelId } },
        update: { isIntensive: trackingType === "intensivo" },
        create: {
          guildId: message.guild.id,
          channelId,
          name: channel.name,
          isIntensive: trackingType === "intensivo",
        },
      });

      return message.reply(
        `El canal <#${channelId}> ha sido configurado como seguimiento ${trackingType}.`
      );
    } catch (error) {
      console.error("Error al guardar el canal en la base de datos:", error);
      return message.reply(
        "Hubo un error al intentar guardar el canal. Por favor, intenta de nuevo."
      );
    }
  },
};
