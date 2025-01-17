import { Message } from "discord.js";
import prisma from "../db";

export const once = false;

export async function execute(message: Message) {
  try {
    // Ignorar mensajes de bots
    if (message.author.bot) return;

    // Asegurarse de que el mensaje proviene de un servidor
    if (!message.guild) return;

    const guildId = message.guild.id;

    // 1. Manejar menciones en canales trackeados
    await handleMentions(message, guildId);

    // 2. Manejar respuestas de usuarios mencionados
    await handleResponses(message, guildId);
  } catch (error) {
    console.error("Error en el evento messageCreate:", error);
  }
}

/**
 * Maneja menciones en canales trackeados
 */
async function handleMentions(message: Message, guildId: string) {
  // Verificar si el canal está trackeado
  const trackedChannel = await prisma.trackedChannel.findUnique({
    where: { channelId: message.channel.id },
  });

  if (!trackedChannel) return; // Ignorar si no está trackeado

  // Verificar menciones
  if (message.mentions.users.size === 0) return;

  for (const [userId, user] of message.mentions.users) {
    // Buscar el miembro para verificar roles
    const member = await message.guild!.members.fetch(userId);

    // Buscar roles trackeados en la base de datos
    const trackedRoles = await prisma.trackedRole.findMany({
      where: { guildId },
      select: { roleId: true },
    });

    const memberHasTrackedRole = trackedRoles.some((role) =>
      member.roles.cache.has(role.roleId)
    );

    if (memberHasTrackedRole) {
      // Crear un registro de mención en la base de datos
      await prisma.mentionRecord.create({
        data: {
          guildId,
          channelId: message.channel.id,
          roleId: trackedRoles.find((role) =>
            member.roles.cache.has(role.roleId)
          )?.roleId as string, // ID del primer rol coincidente
          mentionedId: userId,
          authorId: message.author.id,
          createdAt: new Date(),
        },
      });

      console.log(
        `Registro de mención creado para el usuario ${user.username}`
      );
    }
  }
}

/**
 * Maneja las respuestas de los usuarios mencionados
 */
async function handleResponses(message: Message, guildId: string) {
  // Verificar si hay un registro de mención pendiente para este usuario
  const mentionRecord = await prisma.mentionRecord.findFirst({
    where: {
      guildId,
      channelId: message.channel.id,
      mentionedId: message.author.id,
      respondedAt: null, // Solo menciones sin responder
    },
    orderBy: {
      createdAt: "desc", // Obtener la mención más reciente
    },
  });

  if (!mentionRecord) return; // No hay mención pendiente

  // Calcular el tiempo de respuesta
  const respondedAt = new Date();
  const responseTime =
    respondedAt.getTime() - mentionRecord.createdAt.getTime();

  // Actualizar el registro con el tiempo de respuesta
  await prisma.mentionRecord.update({
    where: { id: mentionRecord.id },
    data: {
      respondedAt,
    },
  });

  console.log(
    `Registro de mención actualizado para ${message.author.username}. Tiempo de respuesta: ${responseTime}ms`
  );
}
