import {
  SlashCommandBuilder,
  InteractionContextType,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  StringSelectMenuInteraction,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  Guild,
} from "discord.js";
import { getOwnedGuilds } from "../../utils";
import prisma from "../../db";

export const command = {
  data: new SlashCommandBuilder()
    .setName("setserver")
    .setDescription("Set the current server to configure it.")
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

    if (guilds.size === 0) {
      return interaction.reply(
        "You do not own any servers where I am a member."
      );
    }

    const guildOptions = guilds.map((guild) => ({
      label: guild.name,
      value: guild.id,
    }));

    let page = 0;
    const pageSize = 10;

    const generateSelectMenu = () => {
      const options = guildOptions
        .slice(page * pageSize, (page + 1) * pageSize)
        .map((guild) => ({
          label: guild.label,
          value: guild.value,
        }));

      return new StringSelectMenuBuilder()
        .setCustomId("select-server")
        .setPlaceholder("Select a server to configure")
        .addOptions(options);
    };

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      generateSelectMenu()
    );

    const prevButton = new ButtonBuilder()
      .setCustomId("prev-page")
      .setLabel("⬅️ Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0);

    const nextButton = new ButtonBuilder()
      .setCustomId("next-page")
      .setLabel("Next ➡️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled((page + 1) * pageSize >= guildOptions.length);

    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      prevButton,
      nextButton
    );

    const message = await interaction.reply({
      content: "Select the server you want to configure:",
      components: [row, buttonRow],
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000,
    });

    collector.on("collect", async (i: StringSelectMenuInteraction) => {
      if (i.user.id !== interaction.user.id) return;

      const selectedGuildId = i.values[0];
      const selectedGuild =
        interaction.client.guilds.cache.get(selectedGuildId);

      if (!selectedGuild) {
        return i.reply({
          content: "There was an error selecting the server. Try again later.",
          ephemeral: true,
        });
      }

      // Save selected server in the database
      await prisma.userContext.upsert({
        where: { userId: interaction.user.id },
        update: { guildId: selectedGuildId },
        create: { userId: interaction.user.id, guildId: selectedGuildId },
      });

      await i.reply({
        content: `✅ You have selected **${selectedGuild.name}** as the server to configure.`,
        ephemeral: true,
      });

      collector.stop();
    });

    const buttonCollector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
    });

    buttonCollector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) return;

      if (i.customId === "prev-page" && page > 0) {
        page--;
      } else if (
        i.customId === "next-page" &&
        (page + 1) * pageSize < guildOptions.length
      ) {
        page++;
      }

      const newRow =
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          generateSelectMenu()
        );

      const newPrevButton = new ButtonBuilder()
        .setCustomId("prev-page")
        .setLabel("⬅️ Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0);

      const newNextButton = new ButtonBuilder()
        .setCustomId("next-page")
        .setLabel("Next ➡️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled((page + 1) * pageSize >= guildOptions.length);

      const newButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        newPrevButton,
        newNextButton
      );

      await i.update({
        content: "Select the server you want to configure:",
        components: [newRow, newButtonRow],
      });
    });
  },
};
