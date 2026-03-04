import Pusher from "pusher";

let pusherInstance: Pusher | null = null;

function getPusher(): Pusher {
  if (!pusherInstance) {
    pusherInstance = new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.PUSHER_CLUSTER!,
      useTLS: true,
    });
  }
  return pusherInstance;
}

// ── Channel name helpers ──────────────────────────────────────────

export function chatChannel(conversationId: string) {
  return `private-chat-${conversationId}`;
}

export function inboxChannel(userId: number) {
  return `private-inbox-${userId}`;
}

export function companyChannel(companyId: number, entity: string) {
  return `private-company-${companyId}-${entity}`;
}

// ── Company-scoped triggers (realtime sync) ──────────────────────

export async function triggerCompanyEvent(
  companyId: number,
  entity: string,
  event: string,
  data: Record<string, unknown> = {}
) {
  try {
    await getPusher().trigger(
      companyChannel(companyId, entity),
      event,
      { ...data, _ts: Date.now() }
    );
  } catch {
    // Fire-and-forget — don't block the request
  }
}

// ── Trigger helpers ───────────────────────────────────────────────

export async function triggerNewMessage(
  conversationId: string,
  message: Record<string, unknown>
) {
  await getPusher().trigger(chatChannel(conversationId), "message:new", {
    message,
  });
}

export async function triggerMessageDeleted(
  conversationId: string,
  messageId: string
) {
  await getPusher().trigger(chatChannel(conversationId), "message:deleted", {
    messageId,
  });
}

export async function triggerInboxUpdate(
  userId: number,
  data: {
    conversationId: string;
    lastMessageText: string;
    unreadCount: number;
  }
) {
  await getPusher().trigger(
    inboxChannel(userId),
    "conversation:updated",
    data
  );
}

// ── Auth for private channels ─────────────────────────────────────

export function authenticateChannel(
  socketId: string,
  channelName: string
) {
  return getPusher().authorizeChannel(socketId, channelName);
}

export { getPusher };
