import { Client, GatewayIntentBits, Partials } from "discord.js";
import dotenv from "dotenv";
import registerEvents from "./events"; // Importar los eventos

// Cargar variables de entorno
dotenv.config();

// Inicializar el cliente de Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages, // Habilitar mensajes directos
  ],
  partials: [Partials.Channel], // Necesario para acceder a canales de mensajes directos
});

// Registrar eventos dinámicamente
registerEvents(client);

// Evento cuando el bot está listo
client.once("ready", () => {
  console.log(`Bot conectado como ${client.user?.tag}`);
});

// Iniciar sesión en Discord
client.login(process.env.DISCORD_TOKEN);
