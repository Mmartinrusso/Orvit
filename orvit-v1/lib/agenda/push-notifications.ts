import { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import prisma from "@/lib/prisma";

const expo = new Expo();

interface TaskPushPayload {
  taskId: number;
  taskTitle: string;
  assignedToUserId: number;
  assignerName: string;
  type: "task_assigned" | "task_updated" | "task_due_soon";
}

/**
 * Send push notification when a task is assigned/updated.
 * Runs async — caller should not await.
 */
export async function sendTaskPushNotification(payload: TaskPushPayload) {
  try {
    const { taskId, taskTitle, assignedToUserId, assignerName, type } = payload;

    // Get active devices for the target user
    const devices = await prisma.userDevice.findMany({
      where: { userId: assignedToUserId, isActive: true },
      select: { pushToken: true, userId: true },
    });

    if (devices.length === 0) return;

    const titleMap = {
      task_assigned: "Nueva tarea asignada",
      task_updated: "Tarea actualizada",
      task_due_soon: "Tarea por vencer",
    };

    const bodyMap = {
      task_assigned: `${assignerName} te asignó: ${taskTitle}`,
      task_updated: `${assignerName} actualizó: ${taskTitle}`,
      task_due_soon: `"${taskTitle}" vence pronto`,
    };

    const messages: ExpoPushMessage[] = [];
    for (const device of devices) {
      if (!Expo.isExpoPushToken(device.pushToken)) continue;

      messages.push({
        to: device.pushToken,
        title: titleMap[type],
        body: bodyMap[type].slice(0, 100),
        data: { taskId, type },
        sound: "default",
        channelId: "task-notifications",
      });
    }

    if (messages.length === 0) return;

    const tickets: ExpoPushTicket[] = [];
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }

    // Deactivate invalid tokens
    const invalidTokens: string[] = [];
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (
        ticket.status === "error" &&
        ticket.details?.error === "DeviceNotRegistered" &&
        devices[i]
      ) {
        invalidTokens.push(devices[i].pushToken);
      }
    }

    if (invalidTokens.length > 0) {
      await prisma.userDevice.updateMany({
        where: { pushToken: { in: invalidTokens } },
        data: { isActive: false },
      });
    }
  } catch (error) {
    console.error("[agenda-push] Failed to send push notification:", error);
  }
}
