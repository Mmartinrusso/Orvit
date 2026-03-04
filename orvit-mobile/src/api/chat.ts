import { apiFetch } from "./client";
import type {
  Conversation,
  Message,
  LoginResponse,
} from "@/types/chat";

// ── Auth ──────────────────────────────────────────────────────────

export async function mobileLogin(
  email: string,
  password: string,
  deviceInfo?: { platform: string; deviceName?: string }
): Promise<LoginResponse> {
  return apiFetch("/api/auth/mobile-login", {
    method: "POST",
    body: JSON.stringify({ email, password, deviceInfo }),
  });
}

// ── Conversations ─────────────────────────────────────────────────

export async function getConversations(params?: {
  archived?: boolean;
  limit?: number;
  cursor?: string;
}): Promise<{ conversations: Conversation[]; nextCursor?: string }> {
  const search = new URLSearchParams();
  if (params?.archived !== undefined) search.set("archived", String(params.archived));
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.cursor) search.set("cursor", params.cursor);

  const qs = search.toString();
  return apiFetch(`/api/chat/conversations${qs ? `?${qs}` : ""}`);
}

export async function createConversation(data: {
  type: "DIRECT" | "CHANNEL" | "CONTEXTUAL";
  name?: string;
  description?: string;
  memberIds: number[];
  entityType?: string;
  entityId?: number;
}): Promise<Conversation> {
  return apiFetch("/api/chat/conversations", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getConversation(id: string): Promise<Conversation> {
  return apiFetch(`/api/chat/conversations/${id}`);
}

// ── Members ───────────────────────────────────────────────────────

export async function getMembers(conversationId: string) {
  return apiFetch<
    { userId: number; role: string; user: { id: number; name: string; avatar: string | null } }[]
  >(`/api/chat/conversations/${conversationId}/members`);
}

// ── Messages ──────────────────────────────────────────────────────

export async function getMessages(
  conversationId: string,
  params?: { cursor?: string; limit?: number }
): Promise<Message[]> {
  const search = new URLSearchParams();
  if (params?.cursor) search.set("cursor", params.cursor);
  if (params?.limit) search.set("limit", String(params.limit));

  const qs = search.toString();
  return apiFetch(
    `/api/chat/conversations/${conversationId}/messages${qs ? `?${qs}` : ""}`
  );
}

export async function sendMessage(
  conversationId: string,
  data: {
    content: string;
    type?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    fileDuration?: number;
    replyToId?: string;
    mentions?: number[];
  }
): Promise<Message> {
  return apiFetch(`/api/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content: data.content,
      type: data.type || "text",
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      fileSize: data.fileSize,
      fileDuration: data.fileDuration,
      replyToId: data.replyToId,
      mentions: data.mentions,
    }),
  });
}

export async function markAsRead(
  conversationId: string,
  messageId?: string
): Promise<void> {
  await apiFetch(`/api/chat/conversations/${conversationId}/read`, {
    method: "PATCH",
    body: JSON.stringify({ messageId }),
  });
}

// ── Reactions ─────────────────────────────────────────────────────

export async function addReaction(messageId: string, emoji: string): Promise<void> {
  await apiFetch(`/api/chat/messages/${messageId}/reactions`, {
    method: "POST",
    body: JSON.stringify({ emoji }),
  });
}

export async function removeReaction(messageId: string, emoji: string): Promise<void> {
  await apiFetch(`/api/chat/messages/${messageId}/reactions?emoji=${encodeURIComponent(emoji)}`, {
    method: "DELETE",
  });
}

// ── Conversation management ──────────────────────────────────

export async function updateConversation(
  id: string,
  data: { name?: string; description?: string; isArchived?: boolean }
): Promise<Conversation> {
  return apiFetch(`/api/chat/conversations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ── Users ─────────────────────────────────────────────────────

export async function getCompanyUsers(): Promise<
  import("@/types/chat").CompanyUser[]
> {
  return apiFetch("/api/users");
}

// ── Message management ───────────────────────────────────────────

export async function editMessage(
  messageId: string,
  content: string
): Promise<Message> {
  return apiFetch(`/api/chat/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify({ content }),
  });
}

export async function deleteMessage(messageId: string): Promise<void> {
  await apiFetch(`/api/chat/messages/${messageId}`, {
    method: "DELETE",
  });
}

// ── Member management ────────────────────────────────────────────

export async function addMembers(
  conversationId: string,
  userIds: number[]
): Promise<{ added: number }> {
  return apiFetch(`/api/chat/conversations/${conversationId}/members`, {
    method: "POST",
    body: JSON.stringify({ userIds }),
  });
}

export async function removeMember(
  conversationId: string,
  userId: number
): Promise<void> {
  await apiFetch(
    `/api/chat/conversations/${conversationId}/members?userId=${userId}`,
    { method: "DELETE" }
  );
}

// ── Typing ───────────────────────────────────────────────────────

export async function sendTyping(conversationId: string): Promise<void> {
  await apiFetch(`/api/chat/conversations/${conversationId}/typing`, {
    method: "POST",
  });
}

// ── Devices ───────────────────────────────────────────────────────

export async function registerDevice(
  pushToken: string,
  platform: "ios" | "android"
): Promise<void> {
  await apiFetch("/api/chat/devices/register", {
    method: "POST",
    body: JSON.stringify({ pushToken, platform }),
  });
}
