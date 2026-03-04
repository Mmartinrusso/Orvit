import { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import prisma from "@/lib/prisma";

const expo = new Expo();

interface PushPayload {
  conversationId: string;
  conversationName: string;
  senderName: string;
  content: string;
  senderId: number;
}

/**
 * Send push notifications to all active members of a conversation
 * (excluding the sender). Runs async — caller should not await.
 */
export async function sendChatPushNotifications(payload: PushPayload) {
  try {
    const { conversationId, conversationName, senderName, content, senderId } =
      payload;

    // Get members who should receive push (not sender, not muted, active)
    const members = await prisma.conversationMember.findMany({
      where: {
        conversationId,
        userId: { not: senderId },
        leftAt: null,
        muted: false,
        OR: [{ mutedUntil: null }, { mutedUntil: { lt: new Date() } }],
      },
      select: { userId: true, unreadCount: true },
    });

    if (members.length === 0) return;

    const userIds = members.map((m) => m.userId);

    // Get active devices for all target users
    const devices = await prisma.userDevice.findMany({
      where: { userId: { in: userIds }, isActive: true },
      select: { pushToken: true, userId: true },
    });

    if (devices.length === 0) return;

    // Calculate badge count per user (total unread across all conversations)
    const badgeCounts = await prisma.conversationMember.groupBy({
      by: ["userId"],
      where: {
        userId: { in: userIds },
        leftAt: null,
        unreadCount: { gt: 0 },
      },
      _sum: { unreadCount: true },
    });

    const badgeMap = new Map(
      badgeCounts.map((b) => [b.userId, b._sum.unreadCount ?? 0])
    );

    // Build push messages
    const messages: ExpoPushMessage[] = [];
    for (const device of devices) {
      if (!Expo.isExpoPushToken(device.pushToken)) continue;

      messages.push({
        to: device.pushToken,
        title: conversationName || senderName,
        body: content.slice(0, 100),
        data: { conversationId, type: "chat_message" },
        sound: "default",
        badge: badgeMap.get(device.userId) ?? 1,
        channelId: "chat-messages",
      });
    }

    if (messages.length === 0) return;

    // Send in chunks (Expo SDK handles batching)
    const tickets: ExpoPushTicket[] = [];
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }

    // Process receipts to deactivate invalid tokens
    await processTickets(tickets, devices);
  } catch (error) {
    console.error("[chat-push] Failed to send push notifications:", error);
  }
}

async function processTickets(
  tickets: ExpoPushTicket[],
  devices: { pushToken: string; userId: number }[]
) {
  const invalidTokens: string[] = [];

  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    if (ticket.status === "error") {
      if (
        ticket.details?.error === "DeviceNotRegistered" &&
        devices[i]
      ) {
        invalidTokens.push(devices[i].pushToken);
      }
    }
  }

  if (invalidTokens.length > 0) {
    await prisma.userDevice.updateMany({
      where: { pushToken: { in: invalidTokens } },
      data: { isActive: false },
    });
    console.log(
      `[chat-push] Deactivated ${invalidTokens.length} invalid push tokens`
    );
  }
}
