import { Message } from "discord.js";
import commands from "../commands"; // Asegúrate de importar los comandos correctamente

export default {
  name: "messageCreate",
  once: false,
  async execute(message: Message) {
    // Ignorar mensajes de bots y mensajes que no tengan el prefijo
    const prefix = "!";
    if (message.author.bot || !message.content.startsWith(prefix)) return;

    // Extraer el nombre del comando y los argumentos
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();

    console.log(`Comando recibido: ${commandName}`);
    console.log("Comandos disponibles:", commands);

    // Buscar el comando en la colección
    const command = commands.get(commandName!);
    if (!command) {
      console.log(`Comando no encontrado: ${commandName}`);
      return;
    }

    try {
      // Ejecutar el comando
      await command.execute(message, args);
    } catch (error) {
      console.error(`Error ejecutando el comando ${commandName}:`, error);
      message.reply("Hubo un error ejecutando ese comando.");
    }
  },
};
