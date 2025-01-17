import { REST } from "discord.js";
import { Routes, Collection } from "discord.js";
import { readdirSync } from "fs";
import { join } from "path";

const commandsCollection = new Collection<string, any>();
const commandsData: any[] = [];

export async function loadCommands(
  clientId: string,
  token: string,
  guildId?: string
) {
  const commandsPath = __dirname;

  const files = readdirSync(commandsPath, { withFileTypes: true });

  for (const file of files) {
    const fullPath = join(commandsPath, file.name);

    if (file.isDirectory()) {
      // Cargar comandos de subcarpetas
      const subFiles = readdirSync(fullPath).filter(
        (f) => f.endsWith(".ts") || f.endsWith(".js")
      );
      for (const subFile of subFiles) {
        const command = require(join(fullPath, subFile)).command;
        if (command?.data) {
          commandsCollection.set(command.data.name, command);
          commandsData.push(command.data.toJSON());
        }
      }
    } else if (
      file.isFile() &&
      (file.name.endsWith(".ts") || file.name.endsWith(".js"))
    ) {
      // Cargar comandos de la carpeta base
      const command = require(fullPath).command;
      if (command?.data) {
        commandsCollection.set(command.data.name, command);
        commandsData.push(command.data.toJSON());
      }
    }
  }

  // Registrar comandos en la API de Discord
  const rest = new REST({ version: "10" }).setToken(token);
  try {
    console.log("Registrando comandos en la API de Discord...");
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commandsData,
      });
    } else {
      await rest.put(Routes.applicationCommands(clientId), {
        body: commandsData,
      });
    }
    console.log("Comandos registrados exitosamente.");
  } catch (error) {
    console.error("Error al registrar los comandos:", error);
  }
}

export { commandsCollection };
