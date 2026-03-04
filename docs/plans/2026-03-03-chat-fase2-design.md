# Chat Empresarial ORVIT — Fase 2 Design Document

**Fecha**: 2026-03-03
**Estado**: Implementado
**Prerequisito**: Fase 0+1 completada (ver `2026-03-03-chat-module-design.md`)

---

## 1. Objetivo

Enriquecer el chat mobile con funcionalidades tipo Discord: audio messages, adjuntos (fotos + archivos), replies, menciones (@usuario), y reacciones emoji.

---

## 2. Decisiones Arquitectónicas

| Decisión | Elección | Justificación |
|----------|----------|---------------|
| Audio recording | **expo-av** | SDK nativo de Expo, graba en M4A (iOS) / 3GP (Android), sin deps extra |
| Audio upload | **S3 via /api/chat/upload** | Mismo endpoint que fotos/archivos, key: `chat/audio/{companyId}/{ts}-{uuid}.ext` |
| Audio transcription | **No (MVP)** | Solo grabar y reproducir. Whisper queda para Fase 3 |
| Attachments | **expo-image-picker + expo-document-picker** | SDKs nativos de Expo, permisos manejados automáticamente |
| Reactions storage | **MessageReaction model** | @@unique([messageId, userId, emoji]), permite toggle, grouped en query |
| Reactions UI | **Quick emoji picker (8 emojis)** | Acceso rápido sin keyboard emoji completo |
| Mentions storage | **Array de IDs en Message.mentions** | Int[] en Prisma, no necesita tabla intermedia |
| Reply storage | **Self-relation en Message** | replyToId → replyTo include en query |
| Realtime reactions | **Pusher events** | reaction:added / reaction:removed broadcast a channel |
| Optimistic updates | **TanStack Query cache** | Reactions se actualizan en cache antes de confirmar API |

---

## 3. Schema Changes

### Message (updated fields)

```prisma
model Message {
  // ... existing fields ...

  // Fase 2 additions
  fileUrl       String?    // S3 URL for audio/image/file
  fileName      String?    // Original file name
  fileSize      Int?       // File size in bytes
  fileDuration  Int?       // Audio duration in seconds

  replyToId     String?
  replyTo       Message?   @relation("MessageReplies", fields: [replyToId], references: [id])
  replies       Message[]  @relation("MessageReplies")

  mentions      Int[]      // Array of mentioned user IDs

  reactions     MessageReaction[]

  type          String     @default("text") // "text" | "system" | "image" | "file" | "audio"
}
```

### MessageReaction (new)

```prisma
model MessageReaction {
  id         String   @id @default(cuid())
  messageId  String
  message    Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
  userId     Int
  user       User     @relation(fields: [userId], references: [id])
  emoji      String   // "👍", "❤️", etc.
  createdAt  DateTime @default(now())

  @@unique([messageId, userId, emoji])
  @@index([messageId])
}
```

---

## 4. New/Updated Endpoints

### POST /api/chat/upload
- Accepts multipart form data
- Supports audio (m4a, ogg, mp3, wav, webm, aac), images (jpg, png, gif, webp), documents (pdf, doc, xls, zip)
- Max 25MB
- S3 key: `chat/{category}/{companyId}/{timestamp}-{uuid}.{ext}`
- Returns: `{ url, key, fileName, fileSize }`

### POST /api/chat/conversations/:id/messages (updated)
- New body fields: `fileUrl`, `fileName`, `fileSize`, `fileDuration`, `replyToId`, `mentions[]`
- Type expanded: `"text" | "system" | "image" | "file" | "audio"`

### GET /api/chat/conversations/:id/messages (updated)
- Includes `replyTo` with sender info
- Groups reactions by emoji with user list: `{ emoji, count, users[] }`

### GET /api/chat/conversations/:id/members
- Returns active members with user info (for mentions dropdown)

### POST /api/chat/messages/:id/reactions
- Body: `{ emoji }`, idempotent upsert
- Broadcasts `reaction:added` via Pusher

### DELETE /api/chat/messages/:id/reactions?emoji=X
- Removes user's reaction for that emoji
- Broadcasts `reaction:removed` via Pusher

---

## 5. Mobile Components

### Audio
- **AudioRecorder**: Hold mic button → record with expo-av → animated pulse + timer → release uploads to S3 → sends audio message
- **AudioPlayer**: Play/pause button + simulated waveform bars + progress indicator + duration

### Replies
- **ReplyBar**: Above input when replying. Shows quoted sender + content preview + close button. Indigo accent stripe.

### Mentions
- **MentionList**: Floating dropdown above input. Triggered by typing `@`. Filters members by text. Tap inserts `@Name` into input.

### Reactions
- **ReactionPicker**: Modal with 8 quick emojis (👍❤️😂😮😢🔥👏🙏). Triggered by long-press on message.
- **ReactionPills**: Emoji pills below message bubble. Shows count, highlighted if user reacted. Tap toggles.

### Chat Screen ([id].tsx)
- MessageBubble renders: text, audio (AudioPlayer), image (Image), file (card with icon), system messages
- Reply preview inside bubble (quoted message with accent)
- Long-press → ReactionPicker
- Tap → set as reply target
- Input area: text input + mic button (no text) / send button (has text) + image picker + file picker
- Pusher events: `message:new`, `reaction:added`, `reaction:removed`
- Optimistic reaction updates in TanStack Query cache

---

## 6. Pusher Events (new)

| Event | Channel | Payload |
|-------|---------|---------|
| `reaction:added` | private-chat-* | `{ messageId, emoji, userId, userName }` |
| `reaction:removed` | private-chat-* | `{ messageId, emoji, userId }` |

---

## 7. Files Created/Modified

### Backend
| File | Action |
|------|--------|
| `prisma/schema.prisma` | Modified: file fields, replyTo relation, mentions[], MessageReaction model |
| `app/api/chat/upload/route.ts` | Created: S3 multipart upload |
| `app/api/chat/messages/[id]/reactions/route.ts` | Created: add/remove reactions |
| `app/api/chat/conversations/[id]/members/route.ts` | Created: list members |
| `app/api/chat/conversations/[id]/messages/route.ts` | Modified: file/reply/mention support |

### Mobile
| File | Action |
|------|--------|
| `src/components/AudioRecorder.tsx` | Created |
| `src/components/AudioPlayer.tsx` | Created |
| `src/components/ReplyBar.tsx` | Created |
| `src/components/MentionList.tsx` | Created |
| `src/components/ReactionPicker.tsx` | Created |
| `src/components/ReactionPills.tsx` | Created |
| `src/types/chat.ts` | Modified: ReactionGroup, file/reply/mention fields |
| `src/api/chat.ts` | Modified: new API functions, updated sendMessage |
| `src/app/chat/[id].tsx` | Rewritten: full Fase 2 features |

---

## 8. Pending / Future

- [ ] **Grupos jerárquicos (Fase 3 — diferenciador clave)**
  - Árbol de hasta 5 niveles de profundidad (más que Discord que solo tiene 2)
  - Cada grupo puede tener subgrupos, cada subgrupo puede tener sub-subgrupos
  - Campo `parentId` en Conversation (self-relation)
  - Herencia de miembros: al unirse a un grupo padre, se tiene acceso a ver subgrupos
  - UI: sidebar con árbol colapsable tipo explorador de archivos
  - Ejemplo: Empresa → Mantenimiento → Turno Mañana → Máquina A
  - Tope configurable por empresa (default: 5 niveles)
- [ ] Mention-specific push notifications (bypass mute)
- [ ] Audio transcription via Whisper (Fase 3)
- [ ] Message search with pg_trgm
- [ ] Web chat widget
- [ ] Online presence indicators
- [ ] Typing indicators
