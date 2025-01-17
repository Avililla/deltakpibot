import { Interaction } from "discord.js";
import { commandsCollection } from "../commands";

export const once = false; // Este evento se ejecutará cada vez que ocurra una interacción.

export async function execute(interaction: Interaction) {
  if (!interaction.isCommand()) return;

  // Obtener el comando de la colección
  const command = commandsCollection.get(interaction.commandName);
  if (!command) {
    console.error(`No se encontró el comando: ${interaction.commandName}`);
    return;
  }

  try {
    // Ejecutar el comando
    await command.execute(interaction);
  } catch (error) {
    console.error(
      `Error al ejecutar el comando ${interaction.commandName}:`,
      error
    );
    await interaction.reply({
      content: "Ocurrió un error al ejecutar este comando.",
      ephemeral: true,
    });
  }
}
