import { Message } from "discord.js";
import prisma from "../../db";
import { isUserAdminOfGuild } from "../../utils";

export default {
  name: "currentserver",
  description: "Muestra el servidor que actualmente estás configurando.",
  async execute(message: Message) {
    // Verificar que el comando viene de un chat privado
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
        "El servidor seleccionado ya no está disponible. Usa `!setserver <nombre del servidor>` para seleccionar otro."
      );
    }

    // Responder con los detalles del servidor actual
    return message.reply(
      `Actualmente estás configurando el servidor **${guild.name}** (ID: ${guild.id}).`
    );
  },
};
