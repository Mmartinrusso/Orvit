export type ConversationType = "DIRECT" | "CHANNEL" | "CONTEXTUAL";

export interface Conversation {
  id: string;
  companyId: number;
  type: ConversationType;
  name: string | null;
  description: string | null;
  entityType: string | null;
  entityId: number | null;
  lastMessageAt: string | null;
  lastMessageText: string | null;
  lastMessageBy: string | null;
  isArchived: boolean;
  createdAt: string;
  createdBy: number;
  members?: ConversationMember[];
  // Joined from ConversationMember for inbox
  unreadCount?: number;
  muted?: boolean;
}

export interface ConversationMember {
  id: string;
  conversationId: string;
  userId: number;
  role: "admin" | "member";
  lastReadAt: string | null;
  unreadCount: number;
  muted: boolean;
  mutedUntil: string | null;
  joinedAt: string;
  leftAt: string | null;
  user?: {
    id: number;
    name: string;
    avatar: string | null;
  };
}

export interface ReactionGroup {
  emoji: string;
  count: number;
  users: { id: number; name: string }[];
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: number | null;
  companyId: number;
  type: "text" | "system" | "image" | "file" | "audio";
  content: string;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileDuration: number | null;
  replyToId: string | null;
  replyTo?: {
    id: string;
    content: string;
    type: string;
    senderId: number | null;
    sender?: { id: number; name: string };
  } | null;
  mentions: number[];
  reactions: ReactionGroup[];
  isDeleted: boolean;
  createdAt: string;
  editedAt: string | null;
  sender?: {
    id: number;
    name: string;
    avatar: string | null;
  };
}

export interface CompanyUser {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  avatar?: string | null;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  systemRole: string;
  sectorId: number | null;
  avatar: string | null;
  companyId: number;
  companyName: string;
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
}

export interface LoginResponse {
  user: AuthUser;
  tokens: AuthTokens;
  sessionId: string;
}
