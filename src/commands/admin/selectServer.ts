import { ChannelType, Message } from "discord.js";
import prisma from "../../db";

export default {
  name: "selectserver",
  description: "Configura el canal donde se usarán los comandos del bot.",
  async execute(message: Message, args: string[]) {
    // Verificar que el comando viene de un chat privado
    if (message.guild) {
      return message.reply(
        "Este comando solo puede ejecutarse desde un chat privado."
      );
    }

    // Recuperar el servidor seleccionado desde la base de datos
    const userContext = await prisma.userContext.findUnique({
      where: { userId: message.author.id },
    });

    if (!userContext) {
      return message.reply(
        "No has seleccionado un servidor. Usa `!selectServer` para listar los servidores disponibles y `!setServer` para elegir uno."
      );
    }

    const guild = message.client.guilds.cache.get(userContext.guildId);
    if (!guild) {
      return message.reply(
        "El servidor seleccionado ya no está disponible. Usa `!selectServer` y `!setServer` nuevamente."
      );
    }

    // Procesar el comando para configurar el canal de comandos
    const channelMention = args[0];
    const channelId = channelMention?.replace("<#", "").replace(">", "");

    if (!channelId) {
      return message.reply("Por favor menciona un canal válido.");
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      return message.reply("Por favor menciona un canal de texto válido.");
    }

    // Usar upsert para actualizar o crear una entrada
    await prisma.guild.upsert({
      where: { guildId: guild.id },
      update: { commandChannelId: channel.id },
      create: {
        guildId: guild.id,
        name: guild.name,
        commandChannelId: channel.id,
      },
    });

    message.reply(
      `El canal de comandos para **${guild.name}** se ha configurado como: ${channel.name}.`
    );
  },
};
