import { Client, User } from "discord.js";

/**
 * Verifica si un usuario es administrador de al menos un servidor donde el bot está presente.
 * @param client - La instancia del cliente de Discord.
 * @param user - El usuario que se desea verificar.
 * @returns `true` si el usuario es administrador de algún servidor donde el bot está presente, `false` en caso contrario.
 */
export async function isUserAdminOfGuild(
  client: Client,
  user: User
): Promise<boolean> {
  // Filtrar los servidores donde el usuario es propietario
  const adminGuilds = client.guilds.cache.filter(
    (guild) => guild.ownerId === user.id
  );

  // Si el usuario no es propietario de ningún servidor, devolver `false`
  return adminGuilds.size > 0;
}
