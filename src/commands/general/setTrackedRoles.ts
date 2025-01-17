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

    // Fetch roles from the guild
    const roles = guild.roles.cache
      .filter((role: any) => !role.managed && role.name !== "@everyone") // Exclude managed and default roles
      .map((role: any) => ({
        label: role.name,
        value: role.id,
      }));

    if (roles.length === 0) {
      return interaction.reply(
        "There are no roles available in this server to configure."
      );
    }

    const trackedRoles = await prisma.trackedRole.findMany({
      where: { guildId: guild.id },
      select: { roleId: true },
    });

    const trackedRoleIds = trackedRoles.map((tr) => tr.roleId);

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("select-tracked-roles")
      .setPlaceholder("Select the roles to track")
      .setMinValues(0)
      .setMaxValues(roles.length)
      .addOptions(
        roles.map((role: any) => ({
          label: role.label,
          value: role.value,
          default: trackedRoleIds.includes(role.value),
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu
    );

    const sentMessage = await interaction.reply({
      content: `Select the roles to configure them as tracked roles in **${guild.name}**:`,
      components: [row],
    });

    const filter = (i: any) =>
      i.user.id === interaction.user.id &&
      i.customId === "select-tracked-roles";

    const collector = sentMessage.createMessageComponentCollector({
      filter,
      time: 60000, // 1 minute to respond
    });

    collector.on("collect", async (i: StringSelectMenuInteraction) => {
      const selectedRoleIds = i.values;

      // Roles to add
      const rolesToAdd = selectedRoleIds.filter(
        (id) => !trackedRoleIds.includes(id)
      );

      // Roles to remove
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
        content: "The roles have been configured successfully.",
        ephemeral: true,
      });

      collector.stop();
    });

    collector.on("end", (collected: any) => {
      if (collected.size === 0) {
        interaction.followUp(
          "You did not select any roles. The command has expired."
        );
      }
    });
  },
};
