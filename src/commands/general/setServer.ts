import {
  SlashCommandBuilder,
  InteractionContextType,
  Guild,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from "discord.js";
import { getOwnedGuilds } from "../../utils";
import prisma from "../../db";

export const command = {
  data: new SlashCommandBuilder()
    .setName("setserver")
    .setDescription("Set the current server for configure it.")
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

    console.log(interaction.user.id);

    const guilds = interaction.client.guilds.cache.filter(
      (guild: Guild) => guild.ownerId === interaction.user.id
    );

    const guildOptions = guilds.map((guild: Guild) => ({
      label: guild.name,
      value: guild.id,
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("select-server")
      .setPlaceholder("Selecciona un servidor")
      .addOptions(guildOptions);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu
    );

    const sentMessage = await interaction.reply({
      content:
        "Select the server you want to configure from the dropdown menu:",
      components: [row],
    });

    const filter = (interaction: any) =>
      interaction.user.id === interaction.user.id &&
      interaction.customId === "select-server";

    const collector = sentMessage.createMessageComponentCollector({
      filter,
      time: 60000, // 1 minuto para seleccionar
    });

    collector.on("collect", async (interaction: any) => {
      const selectedGuildId = (interaction as StringSelectMenuInteraction)
        .values[0];
      const selectedGuild =
        interaction.client.guilds.cache.get(selectedGuildId);

      if (!selectedGuild) {
        return interaction.reply({
          content: "There was an error selecting the server. Try again later.",
          ephemeral: true,
        });
      }

      // Guardar el servidor seleccionado en la base de datos
      await prisma.userContext.upsert({
        where: { userId: interaction.user.id },
        update: { guildId: selectedGuildId },
        create: { userId: interaction.user.id, guildId: selectedGuildId },
      });

      await interaction.reply({
        content: `You have selected **${selectedGuild.name}** as the server to configure.`,
        ephemeral: true,
      });

      collector.stop();
    });

    collector.on("end", (collected: any) => {
      if (collected.size === 0) {
        interaction.reply(
          "You did not select any server. Use `/setserver <server name>` to select one."
        );
      }
    });
    //await interaction.reply(helpMessage);
  },
};
