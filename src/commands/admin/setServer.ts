import {
  ActionRowBuilder,
  Message,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from "discord.js";
import prisma from "../../db";
import { isUserAdminOfGuild } from "../../utils";

export default {
  name: "setserver",
  description: "Establece el servidor que se configurará.",
  async execute(message: Message) {
    // Verificar que el comando viene de un chat privado
    if (message.guild) {
      return message.reply(
        "Este comando solo puede ejecutarse desde un chat privado."
      );
    }

    const isAdmin = await isUserAdminOfGuild(message.client, message.author);
    if (!isAdmin) {
      return message.reply(
        "No puedes usar este comando porque no eres administrador de ningún servidor donde esté el bot."
      );
    }

    // Filtrar servidores donde el usuario es propietario
    const guilds = message.client.guilds.cache.filter(
      (guild) => guild.ownerId === message.author.id
    );

    if (guilds.size === 0) {
      return message.reply(
        "No eres propietario de ningún servidor donde esté configurado el bot."
      );
    }

    // Crear las opciones para el menú de selección
    const guildOptions = guilds.map((guild) => ({
      label: guild.name,
      value: guild.id,
    }));

    // Crear el menú de selección
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("select-server")
      .setPlaceholder("Selecciona un servidor")
      .addOptions(guildOptions);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu
    );

    // Enviar el menú de selección al usuario
    const sentMessage = await message.reply({
      content:
        "Selecciona el servidor que deseas configurar desde el menú desplegable:",
      components: [row],
    });

    // Crear un colector para manejar la interacción del menú
    const filter = (interaction: any) =>
      interaction.user.id === message.author.id &&
      interaction.customId === "select-server";

    const collector = sentMessage.createMessageComponentCollector({
      filter,
      time: 60000, // 1 minuto para seleccionar
    });

    collector.on("collect", async (interaction) => {
      const selectedGuildId = (interaction as StringSelectMenuInteraction)
        .values[0];
      const selectedGuild = message.client.guilds.cache.get(selectedGuildId);

      if (!selectedGuild) {
        return interaction.reply({
          content:
            "Hubo un error al seleccionar el servidor. Intenta de nuevo.",
          ephemeral: true,
        });
      }

      // Guardar el servidor seleccionado en la base de datos
      await prisma.userContext.upsert({
        where: { userId: message.author.id },
        update: { guildId: selectedGuildId },
        create: { userId: message.author.id, guildId: selectedGuildId },
      });

      await interaction.reply({
        content: `Has seleccionado **${selectedGuild.name}** como el servidor para configurar.`,
        ephemeral: true,
      });

      collector.stop();
    });

    collector.on("end", (collected) => {
      if (collected.size === 0) {
        message.reply(
          "No seleccionaste ningún servidor. El comando ha expirado."
        );
      }
    });
  },
};
