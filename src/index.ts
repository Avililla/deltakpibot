import { Client, GatewayIntentBits, Partials } from "discord.js";
import dotenv from "dotenv";
import { loadCommands } from "./commands";
import { loadEvents } from "./events"; // No "envents"

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages, // Habilitar mensajes directos
  ],
  partials: [Partials.Channel], // Necesario para acceder a canales de mensajes directos
});

const TOKEN = process.env.DISCORD_TOKEN!;
const CLIENT_ID = process.env.CLIENT_ID!;
const GUILD_ID = process.env.GUILD_ID!;

(async () => {
  try {
    // Cargar comandos y eventos
    await loadCommands(CLIENT_ID, TOKEN, GUILD_ID);
    await loadEvents(client);

    client.once("ready", () => {
      console.log(`Bot iniciado como ${client.user?.tag}`);
    });

    // Iniciar sesión del bot
    await client.login(TOKEN);
  } catch (error) {
    console.error("Error al iniciar el bot:", error);
  }
})();
