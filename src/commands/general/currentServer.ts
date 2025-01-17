import { SlashCommandBuilder, InteractionContextType } from "discord.js";
import { getOwnedGuilds } from "../../utils";
import prisma from "../../db";

export const command = {
  data: new SlashCommandBuilder()
    .setName("currentserver")
    .setDescription("Displays current server that is being configured.")
    .setContexts(InteractionContextType.BotDM),
  async execute(interaction: any) {
    if (interaction.guild) {
      await interaction.reply(
        "This command can only be used in a direct message with the bot."
      );
      return;
    }

    const ownedGuilds = await getOwnedGuilds(
      interaction.client,
      interaction.user
    );
    if (ownedGuilds.length === 0) {
      await interaction.reply(
        "You are not the owner of any server where I am present."
      );
      return;
    }
    const userContext = await prisma.userContext.findUnique({
      where: { userId: interaction.user.id },
    });

    if (!userContext) {
      return interaction.reply(
        "You do not have any server currently selected. Use `/setserver <server name>` to select one."
      );
    }

    const guild = interaction.client.guilds.cache.get(userContext.guildId);
    if (!guild) {
      return interaction.reply(
        "The selected server is no longer available. Use `/setserver <server name>` to select another one."
      );
    }

    return interaction.reply(
      `You are currently configuring the server **${guild.name}** (ID: ${guild.id}).`
    );
    //await interaction.reply(helpMessage);
  },
};
