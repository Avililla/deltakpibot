import { Guild } from "discord.js";
import prisma from "../db";

export const once = false; // Este evento se ejecutará cada vez que un servidor elimine al bot.

export async function execute(guild: Guild) {
  try {
    // Buscar y eliminar el servidor de la base de datos
    const existingGuild = await prisma.guild.findUnique({
      where: { guildId: guild.id },
    });

    if (!existingGuild) {
      console.log(`El servidor ${guild.name} no existe en la base de datos.`);
      return;
    }

    await prisma.guild.delete({
      where: { guildId: guild.id },
    });

    console.log(
      `El servidor ${guild.name} ha sido eliminado de la base de datos.`
    );
  } catch (error) {
    console.error(
      `Error al eliminar el servidor ${guild.name} de la base de datos:`,
      error
    );
  }
}
