import { Message } from "discord.js";
import prisma from "../../db";
import { isUserAdminOfGuild } from "../../utils";

export default {
  name: "setserver",
  description: "Establece el servidor que se configurará.",
  async execute(message: Message, args: string[]) {
    // Verificar que el comando viene de un chat privado
    if (message.guild) {
      return message.reply(
        "Este comando solo puede ejecutarse desde un chat privado."
      );
    }

    const isAdmin = await isUserAdminOfGuild(message.client, message.author);
    if (!isAdmin) {
      return message.reply(
        "No puedes usar este comando porque no eres administrador de ningún servidor donde esté el bot."
      );
    }

    const serverId = args[0];

    // Si no se proporciona un servidor, listar servidores disponibles
    if (!serverId) {
      // Filtrar servidores donde el usuario es propietario
      const guilds = message.client.guilds.cache.filter(
        (guild) => guild.ownerId === message.author.id
      );

      if (guilds.size === 0) {
        return message.reply(
          "No eres propietario de ningún servidor donde esté configurado el bot."
        );
      }

      // Crear la lista de servidores
      const guildList = guilds
        .map((guild) => `- **${guild.name}** (ID: ${guild.id})`)
        .join("\n");

      return message.reply(
        `Por favor selecciona un servidor usando \`!setserver <ID del servidor>\`. Aquí tienes la lista de servidores disponibles:\n\n${guildList}`
      );
    }

    // Verificar si el servidor es válido y si el usuario es el propietario
    const guild = message.client.guilds.cache.get(serverId);
    if (!guild) {
      return message.reply("No encontré un servidor con ese ID.");
    }

    if (guild.ownerId !== message.author.id) {
      return message.reply("No eres el propietario de este servidor.");
    }

    // Guardar el servidor seleccionado en la base de datos
    await prisma.userContext.upsert({
      where: { userId: message.author.id },
      update: { guildId: serverId },
      create: { userId: message.author.id, guildId: serverId },
    });

    message.reply(
      `Has seleccionado **${guild.name}** como el servidor para configurar.`
    );
  },
};
