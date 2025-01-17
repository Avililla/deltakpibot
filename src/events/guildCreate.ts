import { Guild } from "discord.js";
import { commandsCollection } from "../commands";
import prisma from "../db";

export const once = false; // Este evento se ejecutará cada vez que ocurra una interacción.

export async function execute(guild: Guild) {
  try {
    // Busca al propietario del servidor
    const owner = await guild.fetchOwner();

    // Guarda el servidor en la base de datos si no existe
    const existingGuild = await prisma.guild.findUnique({
      where: { guildId: guild.id },
    });

    if (!existingGuild) {
      await prisma.guild.create({
        data: {
          guildId: guild.id,
          name: guild.name,
        },
      });
    }

    // Enviar mensaje al propietario con instrucciones
    const message = `
        ¡Hola! Gracias por añadirme a **${guild.name}**.
        
        Para configurar el bot, utiliza los siguientes comandos:
        - \`!setserver <nombre del servidor>\`: Selecciona el servidor que deseas configurar.
        - \`!currentserver\`: Muestra el servidor que actualmente estás configurando.
        - \`!getchannels\`: Devuelve los canales de texto disponibles para el servidor seleccionado.
        - \`!setCommandChannel #canal\`: Configura el canal donde se usarán los comandos del bot.
        - \`!addChannel #canal [intensivo/no-intensivo]\`: Añade un canal para seguimiento.
        - \`!addRole @rol\`: Añade un rol para seguimiento.
        
        Si necesitas más ayuda, no dudes en preguntar.
        `;

    if (owner.user.dmChannel) {
      await owner.user.dmChannel.send(message);
    } else {
      await owner.user.send(message);
    }

    console.log(`Mensaje enviado al propietario de ${guild.name}.`);
  } catch (error) {
    console.error(
      `No se pudo enviar un mensaje al propietario de ${guild.name}:`,
      error
    );
  }
}
