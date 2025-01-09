import { readdirSync } from "fs";
import { join } from "path";
import { Collection } from "discord.js";

interface Command {
  name: string;
  description: string;
  execute: Function;
}

// Colección para almacenar todos los comandos
const commands = new Collection<string, Command>();

// Ruta de la carpeta actual
const commandsPath = __dirname;

// Leer todas las subcarpetas (categorías) y cargar los comandos
const categories = readdirSync(commandsPath, { withFileTypes: true }).filter(
  (dirent) => dirent.isDirectory()
);

for (const category of categories) {
  const categoryPath = join(commandsPath, category.name);
  const commandFiles = readdirSync(categoryPath).filter((file) =>
    file.endsWith(".ts")
  );

  for (const file of commandFiles) {
    const command = require(join(categoryPath, file)).default as Command;
    console.log(`Cargando comando ${command.name}`);
    commands.set(command.name, command);
  }
}

export default commands;
