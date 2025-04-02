import { SlashCommandBuilder, InteractionContextType } from "discord.js";

export const command = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Shows available commands.")
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),
  async execute(interaction: any) {
    // Define admin commands data
    const adminCommands = [
      { name: "help", description: "Shows this help message." },
      {
        name: "currentserver",
        description:
          "Displays the server currently selected for configuration.",
      },
      {
        name: "setserver",
        description: "Sets the current server to configure.",
      },
      {
        name: "settrackedchannel",
        description: "Adds or removes a tracked channel by its ID.",
      },
      {
        name: "settrackedroles",
        description:
          "Sets the roles to be tracked for mentions in the selected server.",
      },
      {
        name: "storechannelhistory",
        description:
          "Processes and stores mention history for a selected tracked channel.",
      },
    ];

    // Build the help message dynamically
    let helpMessage = `
Hi! I'm the Delta KPI tracking bot.

Here are the available commands to configure the bot (most require being run in a Direct Message with me):
`;

    adminCommands.forEach((cmd) => {
      helpMessage += `\\n- \`/${cmd.name}\`: ${cmd.description}`;
    });

    helpMessage += `

**Basic steps to get started:**
1. Use \`/setserver\` in a DM to select the server you want to configure.
2. Use \`/settrackedchannel\` to add the channels where you want me to monitor mentions.
3. Use \`/settrackedroles\` to specify which user roles should be monitored when mentioned.
4. (Optional) Use \`/storechannelhistory\` if you want me to process old messages in an already tracked channel.
`;

    await interaction.reply({ content: helpMessage, ephemeral: true });
  },
};
