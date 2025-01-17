import { Client } from "discord.js";
import { readdirSync } from "fs";
import { join } from "path";

export async function loadEvents(client: Client) {
  const eventsPath = __dirname;

  const files = readdirSync(eventsPath, { withFileTypes: true });

  for (const file of files) {
    const fullPath = join(eventsPath, file.name);

    if (
      file.isFile() &&
      (file.name.endsWith(".ts") || file.name.endsWith(".js"))
    ) {
      const event = require(fullPath);
      console.log(`Cargando evento ${file.name.split(".")[0]}`);
      if (event.once) {
        client.once(file.name.split(".")[0], (...args: any[]) =>
          event.execute(...args, client)
        );
      } else {
        client.on(file.name.split(".")[0], (...args: any[]) =>
          event.execute(...args, client)
        );
      }
    }
  }
}
