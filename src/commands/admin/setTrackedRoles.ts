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
    .setName("settrackedroles")
    .setDescription("Set tracked roles for the selected server.")
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
        "You don't have any server selected. Use `/setserver <server name>` to select one."
      );
    }

    const guild = interaction.client.guilds.cache.get(userContext.guildId);
    if (!guild) {
      return interaction.reply(
        "The selected server could not be found. Make sure the bot is still in the server."
      );
    }

    // Fetch all roles, excluding managed roles and @everyone
    const roles = guild.roles.cache
      .filter((role) => !role.managed && role.name !== "@everyone")
      .map((role) => ({
        label: role.name,
        value: role.id,
      }));

    const trackedRoles = await prisma.trackedRole.findMany({
      where: { guildId: guild.id },
      select: { roleId: true },
    });

    const trackedRoleIds = trackedRoles.map((tr) => tr.roleId);

    let page = 0;
    const pageSize = 10;

    const generateSelectMenu = () => {
      const options = roles
        .slice(page * pageSize, (page + 1) * pageSize)
        .map((role) => ({
          label: role.label,
          value: role.value,
          default: trackedRoleIds.includes(role.value),
        }));

      return new StringSelectMenuBuilder()
        .setCustomId("select-tracked-roles")
        .setPlaceholder("Select roles to track")
        .setMinValues(0)
        .setMaxValues(options.length)
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
      .setDisabled((page + 1) * pageSize >= roles.length);

    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      prevButton,
      nextButton
    );

    const message = await interaction.reply({
      content: `Select the roles to track in **${guild.name}**:`,
      components: [row, buttonRow],
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000,
    });

    collector.on("collect", async (i: StringSelectMenuInteraction) => {
      if (i.user.id !== interaction.user.id) return;

      const selectedRoleIds = i.values;
      const rolesToAdd = selectedRoleIds.filter(
        (id) => !trackedRoleIds.includes(id)
      );
      const rolesToRemove = trackedRoleIds.filter(
        (id) => !selectedRoleIds.includes(id)
      );

      // Add new roles
      for (const roleId of rolesToAdd) {
        const role = guild.roles.cache.get(roleId);
        if (role) {
          await prisma.trackedRole.create({
            data: {
              roleId,
              guildId: guild.id,
              name: role.name,
            },
          });
        }
      }

      // Remove unselected roles
      for (const roleId of rolesToRemove) {
        await prisma.trackedRole.deleteMany({
          where: { guildId: guild.id, roleId },
        });
      }

      await i.reply({
        content: "Roles have been updated successfully.",
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
        (page + 1) * pageSize < roles.length
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
        .setDisabled((page + 1) * pageSize >= roles.length);

      const newButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        newPrevButton,
        newNextButton
      );

      await i.update({
        content: `Select the roles to track in **${guild.name}**:`,
        components: [newRow, newButtonRow],
      });
    });
  },
};
