import { SlashCommandBuilder, InteractionContextType } from "discord.js";

export const command = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Send command help to user.")
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),
  async execute(interaction: any) {
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
    await interaction.reply(helpMessage);
  },
};
