import { Message, PartialMessage } from "discord.js";
import prisma from "../db";

export const once = false;

export async function execute(message: Message | PartialMessage) {
  try {
    // Asegurarse de que tenemos un ID de mensaje
    if (!message.id) {
      console.warn("Mensaje eliminado sin ID, no se puede procesar.");
      return;
    }

    const messageId = message.id;

    // Intentar eliminar el registro de mención asociado al mensaje eliminado
    const deleteResult = await prisma.mentionRecord.deleteMany({
      where: {
        messageId: messageId,
      },
    });

    if (deleteResult.count > 0) {
      console.log(
        `Registro de mención asociado al mensaje ${messageId} eliminado.`
      );
    } else {
      console.log(
        `No se encontró registro de mención para el mensaje eliminado ${messageId}.`
      );
    }
  } catch (error) {
    console.error("Error en el evento messageDelete:", error);
  }
}
