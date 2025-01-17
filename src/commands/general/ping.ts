import { SlashCommandBuilder, InteractionContextType } from "discord.js";

export const command = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Responde con Pong!")
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM), // Habilita el comando en servidores y DMs con el bot
  async execute(interaction: any) {
    await interaction.reply("Pong! 🏓");
  },
};
