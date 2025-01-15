import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  Message,
  StringSelectMenuInteraction,
} from "discord.js";
import prisma from "../../db";
import { isUserAdminOfGuild } from "../../utils";

export default {
  name: "settrackedroles",
  description: "Selecciona los roles que serán trackeados en el servidor.",
  async execute(message: Message) {
    if (message.guild) {
      return message.reply(
        "Este comando solo puede ejecutarse desde un chat privado."
      );
    }

    // Verificar que el usuario es administrador de al menos un servidor donde esté el bot
    const isAdmin = await isUserAdminOfGuild(message.client, message.author);
    if (!isAdmin) {
      return message.reply(
        "No puedes usar este comando porque no eres administrador de ningún servidor donde esté el bot."
      );
    }

    // Obtener el contexto del servidor para el usuario actual
    const userContext = await prisma.userContext.findUnique({
      where: { userId: message.author.id },
    });

    if (!userContext) {
      return message.reply(
        "No tienes ningún servidor seleccionado actualmente. Usa `!setserver` para seleccionar uno."
      );
    }

    // Buscar información del servidor en el cliente del bot
    const guild = message.client.guilds.cache.get(userContext.guildId);

    if (!guild) {
      return message.reply(
        "No se pudo encontrar el servidor seleccionado. Verifica que el bot sigue estando en el servidor."
      );
    }

    // Obtener los roles del servidor
    const roles = guild.roles.cache.map((role) => ({
      label: role.name,
      value: role.id,
    }));

    if (roles.length === 0) {
      return message.reply(
        "No hay roles disponibles en este servidor para configurar."
      );
    }

    // Obtener los roles ya seleccionados
    const trackedRoles = await prisma.trackedRole.findMany({
      where: { guildId: guild.id },
      select: { roleId: true },
    });

    const trackedRoleIds = trackedRoles.map((tr) => tr.roleId);

    // Crear un menú de selección de roles
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("select-tracked-roles")
      .setPlaceholder("Selecciona los roles para seguimiento")
      .setMinValues(0)
      .setMaxValues(roles.length)
      .addOptions(
        roles.map((role) => ({
          label: role.label,
          value: role.value,
          default: trackedRoleIds.includes(role.value),
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu
    );

    // Enviar el menú de selección al usuario
    const sentMessage = await message.reply({
      content: `Selecciona los roles para configurarlos como roles de seguimiento en **${guild.name}**:`,
      components: [row],
    });

    // Crear un colector de interacciones
    const filter = (interaction: any) =>
      interaction.user.id === message.author.id &&
      interaction.customId === "select-tracked-roles";

    const collector = sentMessage.createMessageComponentCollector({
      filter,
      time: 60000, // 1 minuto para responder
    });

    collector.on("collect", async (interaction) => {
      const selectedRoleIds = (interaction as StringSelectMenuInteraction)
        .values;

      // Roles a agregar
      const rolesToAdd = selectedRoleIds.filter(
        (id) => !trackedRoleIds.includes(id)
      );

      // Roles a eliminar
      const rolesToRemove = trackedRoleIds.filter(
        (id) => !selectedRoleIds.includes(id)
      );

      // Agregar nuevos roles
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

      // Eliminar roles que ya no están seleccionados
      for (const roleId of rolesToRemove) {
        await prisma.trackedRole.deleteMany({
          where: { guildId: guild.id, roleId },
        });
      }

      await interaction.reply({
        content: `Los roles seleccionados se han actualizado correctamente.`,
        ephemeral: true,
      });

      collector.stop();
    });

    collector.on("end", (collected) => {
      if (collected.size === 0) {
        message.reply("No seleccionaste ningún rol. El comando ha expirado.");
      }
    });
  },
};
