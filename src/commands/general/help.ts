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
    - \`/help\`: Gives help to user.
    - \`/currentserver\`: Shows current server that is being configured.
    - \`/setserver\`: Sets current server that is going to be configured.
    - \`/settrackedchannels\`: Add channel for track it.
    - \`/addRole\`: Add role for track it.
    
    Select server for configure it, using \`/setserver\` command, and then add channels and roles for track it.
    `;
    await interaction.reply(helpMessage);
  },
};
