import { Message } from "discord.js";
import { isUserAdminOfGuild } from "../../utils";

export default {
  name: "help",
  description: "Muestra las instrucciones para configurar el bot.",
  async execute(message: Message) {
    // Verificar que el comando se ejecute en un chat privado
    if (message.guild) {
      return message.reply(
        "Este comando solo puede ejecutarse desde un chat privado. Por favor, envíame un mensaje directo."
      );
    }

    // Verificar que el usuario es administrador de al menos un servidor donde esté el bot
    const isAdmin = await isUserAdminOfGuild(message.client, message.author);
    if (!isAdmin) {
      return message.reply(
        "No puedes usar este comando porque no eres administrador de ningún servidor donde esté el bot."
      );
    }

    // Crear el mensaje de ayuda
    const helpMessage = `
    ¡Hola! Gracias por añadirme a tu servidor.
    
    Para configurar el bot, utiliza los siguientes comandos:
    - \`!setserver <nombre del servidor>\`: Selecciona el servidor que deseas configurar.
    - \`!currentserver\`: Muestra el servidor que actualmente estás configurando.
    - \`!setCommandChannel #canal\`: Configura el canal donde se usarán los comandos del bot.
    - \`!addChannel #canal [intensivo/no-intensivo]\`: Añade un canal para seguimiento.
    - \`!addRole @rol\`: Añade un rol para seguimiento.
    
    Si necesitas más ayuda, no dudes en preguntar.
    `;

    // Enviar el mensaje de ayuda
    return message.author.send(helpMessage).catch(() => {
      message.reply(
        "No puedo enviarte un mensaje privado. Por favor, habilita tus mensajes directos."
      );
    });
  },
};
