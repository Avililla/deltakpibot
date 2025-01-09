import { Client } from "discord.js";
import { readdirSync } from "fs";
import path from "path";

export default function registerEvents(client: Client) {
  const eventsPath = __dirname; // Carpeta de eventos
  const eventFiles = readdirSync(eventsPath).filter((file) =>
    file.endsWith(".ts")
  );

  for (const file of eventFiles) {
    if (file === "index.ts") continue; // Evitar el archivo index.ts
    const filePath = path.join(eventsPath, file);
    const event = require(filePath).default;
    console.log(`Cargando evento ${event.name}`);

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }
}
