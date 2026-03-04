# Chat Empresarial ORVIT — Design Document

**Fecha**: 2026-03-03
**Estado**: Aprobado
**Autor**: Claude (Arquitecto) + revisión ChatGPT (correcciones adoptadas)

---

## 1. Objetivo

Crear un módulo de chat empresarial interno para ORVIT, reemplazando WhatsApp. Incluye una app móvil (Expo React Native) que consume endpoints del backend Next.js existente. Realtime via Pusher Channels, push notifications via Expo Push API.

---

## 2. Decisiones Arquitectónicas

| Decisión | Elección | Justificación |
|----------|----------|---------------|
| Realtime | **Pusher Channels** | Vercel no soporta WebSockets nativos. Pusher: free tier 200K msg/día, SDK React Native nativo, setup en 10 min |
| Mobile framework | **Expo (React Native)** | Iteración rápida, EAS Build para iOS/Android, Expo Router para navegación |
| Mobile repo | **Monorepo** (`orvit-mobile/` junto a `orvit-v1/`) | Un solo repo, sin tipos desincronizados |
| Push | **Expo Push API** (FCM/APNs por detrás) | SDK nativo, sin configurar Firebase/APNs directamente para MVP |
| Auth mobile | **Bearer token** (no cookies) | React Native no maneja cookies httpOnly. Tokens en expo-secure-store |
| File storage | **S3** (existente, `mawir-bucket`) | Ya configurado, upload endpoint centralizado |
| IDs chat | **cuid()** | Menos predecibles que autoincrement para URLs |
| Unread tracking | **lastReadAt + unreadCount denormalizado** | No por message ID (cuid no es monotónico). Count denormalizado para inbox O(1) |

---

## 3. Modelo de Datos (Prisma)

### 3.1 Conversation

```prisma
enum ConversationType {
  DIRECT      // 1:1
  CHANNEL     // Grupo/canal
  CONTEXTUAL  // Asociado a entidad (OT, Falla, Máquina)
}

model Conversation {
  id            String             @id @default(cuid())
  companyId     Int
  company       Company            @relation(fields: [companyId], references: [id])
  type          ConversationType
  name          String?            // null para DIRECT, obligatorio para CHANNEL/CONTEXTUAL
  description   String?

  // Contextual link (solo para type=CONTEXTUAL)
  entityType    String?            // "work_order" | "failure" | "machine"
  entityId      Int?

  // DIRECT uniqueness — evita duplicados de chat 1:1
  directUserAId Int?               // min(userId1, userId2)
  directUserBId Int?               // max(userId1, userId2)

  // Denormalized for inbox performance
  lastMessageAt   DateTime?
  lastMessageText String?          // Preview truncado (100 chars)
  lastMessageBy   String?          // Nombre del sender

  // Retention (defaults aplicados en código por tipo)
  retentionDays Int                @default(365)

  isArchived    Boolean            @default(false)
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt
  createdBy     Int                // userId que creó la conversación

  members       ConversationMember[]
  messages      Message[]

  @@unique([companyId, directUserAId, directUserBId]) // Evita chats DIRECT duplicados
  @@index([companyId, isArchived, lastMessageAt(sort: Desc)])
  @@index([companyId, entityType, entityId])
  @@index([companyId, type])
}
```

**Notas**:
- `directUserAId/directUserBId`: al crear DIRECT, se setean como `min(userA, userB)` y `max(userA, userB)`. El `@@unique` garantiza un solo chat directo entre 2 usuarios por empresa.
- `lastMessageAt/Text/By`: denormalizados para que el inbox sea un simple SELECT sin JOINs a messages.
- `retentionDays`: el schema default es 365. Los defaults por tipo se aplican en el endpoint de creación:
  - DIRECT: 365 días
  - CHANNEL: 365 días
  - CONTEXTUAL: 730 días (es evidencia operativa, debe durar más)

### 3.2 ConversationMember

```prisma
model ConversationMember {
  id               String       @id @default(cuid())
  conversationId   String
  conversation     Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  userId           Int
  user             User         @relation(fields: [userId], references: [id])

  role             String       @default("member") // "admin" | "member"

  // Read tracking — por fecha, NO por message ID (cuid no es monotónico)
  lastReadAt         DateTime?
  lastReadMessageId  String?      // Referencia al último mensaje leído (informativo)
  unreadCount        Int          @default(0) // Denormalizado para inbox O(1)

  // Notification prefs per conversation
  muted            Boolean      @default(false)
  mutedUntil       DateTime?

  joinedAt         DateTime     @default(now())
  leftAt           DateTime?    // null = active member

  @@unique([conversationId, userId])
  @@index([userId, leftAt]) // Inbox: "mis conversaciones activas"
}
```

**Notas**:
- `lastReadAt` es la fuente de verdad para unread. `lastReadMessageId` es solo referencia.
- `unreadCount` se incrementa en `message.create` y se resetea a 0 en `PATCH /read`.
- El inbox NO hace `COUNT(*)` — lee `unreadCount` directamente.

### 3.3 Message

```prisma
model Message {
  id               String       @id @default(cuid())
  conversationId   String
  conversation     Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  senderId         Int?         // null para system messages
  sender           User?        @relation(fields: [senderId], references: [id])
  companyId        Int          // Denormalized para queries directas y cleanup

  type             String       @default("text") // "text" | "system" | "image" | "file"
  content          String       // Texto o JSON para system messages

  // Preparado para Fase 2
  replyToId        String?

  isDeleted        Boolean      @default(false)
  createdAt        DateTime     @default(now())
  editedAt         DateTime?

  @@index([conversationId, createdAt(sort: Desc)]) // Paginación por cursor
  @@index([companyId, createdAt(sort: Desc)])       // Queries globales por company
}
```

**Paginación**: cursor-based por `createdAt`:
```sql
WHERE conversationId = :id AND createdAt < :cursor
ORDER BY createdAt DESC
LIMIT 50
```

### 3.4 UserDevice (Push Tokens)

```prisma
model UserDevice {
  id           String   @id @default(cuid())
  userId       Int
  user         User     @relation(fields: [userId], references: [id])
  companyId    Int

  pushToken    String   // Expo push token
  platform     String   // "ios" | "android"
  deviceName   String?

  isActive     Boolean  @default(true)
  lastUsedAt   DateTime @default(now())
  createdAt    DateTime @default(now())

  @@unique([userId, pushToken])
  @@index([userId, isActive])
}
```

**Cleanup de tokens inválidos**: después de enviar push, parsear Expo receipts. Si `DeviceNotRegistered` → `isActive = false`.

---

## 4. Endpoints Backend

Todos en `orvit-v1/app/api/chat/`. Protegidos con `withGuards` + validación `companyId` + membership check.

### 4.1 Conversations

```
POST   /api/chat/conversations              — Crear conversación
GET    /api/chat/conversations              — Inbox (mis conversaciones activas)
GET    /api/chat/conversations/:id          — Detalle conversación + members
PATCH  /api/chat/conversations/:id          — Editar (nombre, descripción, archivar)
```

**POST /api/chat/conversations** — Crear:
```ts
// Zod schema
{
  type: "DIRECT" | "CHANNEL" | "CONTEXTUAL",
  name?: string,           // Requerido para CHANNEL/CONTEXTUAL
  description?: string,
  memberIds: number[],     // Para DIRECT: exactamente 1 ID (el otro es el sender)
  entityType?: string,     // Solo CONTEXTUAL
  entityId?: number,       // Solo CONTEXTUAL
}

// Lógica DIRECT:
// 1. Calcular directUserAId = min(sender, target), directUserBId = max(sender, target)
// 2. Buscar existente con @@unique
// 3. Si existe → return 200 con la conversación existente
// 4. Si no → crear nueva

// Retention defaults por tipo:
const RETENTION = { DIRECT: 365, CHANNEL: 365, CONTEXTUAL: 730 };
```

**GET /api/chat/conversations** — Inbox:
```ts
// Query params: ?archived=false&limit=30&cursor=<lastMessageAt>

// Query:
SELECT c.*, cm.unreadCount, cm.muted
FROM Conversation c
JOIN ConversationMember cm ON cm.conversationId = c.id
WHERE cm.userId = :userId
  AND cm.leftAt IS NULL
  AND c.companyId = :companyId
  AND c.isArchived = :archived
ORDER BY c.lastMessageAt DESC NULLS LAST
LIMIT :limit
```

### 4.2 Messages

```
GET    /api/chat/conversations/:id/messages — Mensajes paginados
POST   /api/chat/conversations/:id/messages — Enviar mensaje
PATCH  /api/chat/conversations/:id/read     — Marcar como leído
```

**POST /api/chat/conversations/:id/messages** — Enviar:
```ts
// Zod schema
{
  content: string,         // 1-4000 chars
  type?: "text" | "system", // default "text"
}

// Flow (pseudocódigo):
async function sendMessage(conversationId, userId, body) {
  // 1. Validar membership
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } }
  });
  if (!member || member.leftAt) throw 403;

  // 2. Transaction: crear mensaje + actualizar conversation + incrementar unread
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        companyId: member.conversation.companyId,
        content: body.content,
        type: body.type ?? "text",
      }
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        lastMessageText: body.content.slice(0, 100),
        lastMessageBy: user.name,
      }
    }),
    // Incrementar unreadCount para todos los members excepto sender
    prisma.conversationMember.updateMany({
      where: {
        conversationId,
        userId: { not: userId },
        leftAt: null,
      },
      data: { unreadCount: { increment: 1 } }
    }),
  ]);

  // 3. Pusher: broadcast a la conversación
  await pusher.trigger(
    `private-chat-${conversationId}`,
    'message:new',
    { message: serialize(message) }
  );

  // 4. Pusher: update inbox de cada member
  const members = await prisma.conversationMember.findMany({
    where: { conversationId, leftAt: null, userId: { not: userId } }
  });
  for (const m of members) {
    await pusher.trigger(
      `private-inbox-${m.userId}`,
      'conversation:updated',
      { conversationId, lastMessageText: body.content.slice(0, 100), unreadCount: m.unreadCount + 1 }
    );
  }

  // 5. Push notifications (async, no bloquea response)
  queuePushNotifications(conversationId, userId, message);

  return message;
}
```

**PATCH /api/chat/conversations/:id/read** — Marcar leído:
```ts
// Body: { messageId?: string } (opcional, para saber hasta dónde leyó)

await prisma.conversationMember.update({
  where: { conversationId_userId: { conversationId, userId } },
  data: {
    lastReadAt: new Date(),
    lastReadMessageId: body.messageId ?? undefined,
    unreadCount: 0,
  }
});

// Opcional: notificar al sender que el otro leyó (Fase 2)
```

### 4.3 Devices (Push)

```
POST   /api/chat/devices/register   — Registrar push token
DELETE /api/chat/devices/:token      — Desregistrar push token
```

### 4.4 Pusher Auth

```
POST   /api/chat/pusher/auth        — Autenticar canal privado de Pusher
```

Pusher requiere un endpoint de auth para canales `private-*`. Este endpoint:
1. Verifica JWT del usuario
2. Verifica que el usuario sea member de la conversación (para `private-chat-{id}`)
3. Retorna `auth` signature de Pusher

---

## 5. Realtime (Pusher Channels)

### Channels

| Channel | Formato | Quién subscribe | Propósito |
|---------|---------|-----------------|-----------|
| `private-chat-{conversationId}` | Private | Members de la conversación | Mensajes nuevos, edits, deletes |
| `private-inbox-{userId}` | Private | El usuario | Updates al inbox (nuevo msg, unread count) |

### Events

| Event | Channel | Origen | Payload |
|-------|---------|--------|---------|
| `message:new` | private-chat-* | Server | `{ message: Message }` |
| `message:deleted` | private-chat-* | Server | `{ messageId: string }` |
| `conversation:updated` | private-inbox-* | Server | `{ conversationId, lastMessageText, unreadCount }` |
| `client-typing:start` | private-chat-* | Client | `{ userId, userName }` |
| `client-typing:stop` | private-chat-* | Client | `{ userId }` |

**Nota**: eventos `client-*` son peer-to-peer via Pusher (no pasan por nuestro server). Requieren canal `private` o `presence`.

---

## 6. Push Notifications

### Flow

```
1. App se abre → Expo.Notifications.getExpoPushTokenAsync()
2. POST /api/chat/devices/register { pushToken, platform }
3. Cuando llega mensaje:
   a. Obtener members activos de la conversación (!= sender, leftAt IS NULL)
   b. Para cada member: chequear muted/mutedUntil
   c. Buscar UserDevice activos del member
   d. Enviar batch via Expo Push API:
      {
        to: pushToken,
        title: conversationName || senderName,
        body: content.slice(0, 100),
        data: { conversationId, type: "chat_message" },
        sound: "default",
        badge: totalUnreadCount,
      }
4. Parsear Expo push receipts:
   - Si DeviceNotRegistered → UserDevice.isActive = false
   - Si error transitorio → retry con backoff
5. App recibe push → deep link a /chat/{conversationId}
```

### Badge count

El `badge` en el push se calcula como suma de `unreadCount` de todas las conversaciones activas del usuario:
```sql
SELECT SUM(unreadCount) FROM ConversationMember
WHERE userId = :userId AND leftAt IS NULL AND unreadCount > 0
```

---

## 7. Mobile App (Expo)

### Estructura

```
orvit-mobile/
├── app.json
├── eas.json
├── package.json
├── tsconfig.json
├── src/
│   ├── app/                       # Expo Router
│   │   ├── _layout.tsx            # Root: QueryClientProvider, AuthProvider, PusherProvider
│   │   ├── login.tsx              # Login screen
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx        # Tab navigator (Inbox, Settings)
│   │   │   ├── inbox.tsx          # Lista de conversaciones
│   │   │   └── settings.tsx       # Perfil, logout, notif prefs
│   │   └── chat/
│   │       └── [id].tsx           # Chat screen (mensajes)
│   ├── api/
│   │   ├── client.ts              # Fetch wrapper con Bearer auth + auto-refresh
│   │   └── chat.ts                # Funciones: getConversations, getMessages, sendMessage, etc.
│   ├── hooks/
│   │   ├── useAuth.ts             # Login, logout, token management
│   │   ├── useConversations.ts    # TanStack Query: lista de conversaciones
│   │   ├── useMessages.ts        # TanStack Query: infinite scroll de mensajes
│   │   └── usePusher.ts          # Hook para subscribirse a Pusher channels
│   ├── components/
│   │   ├── MessageBubble.tsx      # Burbuja de mensaje (texto, system)
│   │   ├── ConversationItem.tsx   # Item del inbox
│   │   ├── ChatInput.tsx          # Input + send button
│   │   └── TypingIndicator.tsx    # "Fulano está escribiendo..."
│   ├── contexts/
│   │   └── AuthContext.tsx         # Auth state, tokens en SecureStore
│   ├── lib/
│   │   ├── pusher.ts              # Pusher client singleton
│   │   ├── notifications.ts      # Expo push registration
│   │   └── storage.ts            # expo-secure-store wrapper
│   └── types/
│       └── chat.ts                # Tipos: Conversation, Message, etc.
```

### Auth Mobile

El sistema web usa cookies httpOnly que no funcionan en React Native. Solución:

```
POST /api/auth/mobile-login
Body: { email, password }
Response: {
  accessToken: string,   // JWT, 15 min
  refreshToken: string,  // Opaque, 30 días (extendido vs 1 día web)
  user: { id, name, email, role, companyId }
}
```

- Tokens guardados en `expo-secure-store` (encrypted native storage)
- `api/client.ts` envía `Authorization: Bearer {accessToken}` en cada request
- On 401 → llama `POST /api/auth/refresh` con refreshToken en body → rota tokens
- Refresh token mobile: **30 días** (vs 1 día en web) para mejor UX mobile

### Realtime Integration

```tsx
// usePusher.ts
function useChatChannel(conversationId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = pusher.subscribe(`private-chat-${conversationId}`);

    channel.bind('message:new', (data) => {
      // Optimistic update: agregar mensaje al cache de TanStack Query
      queryClient.setQueryData(['messages', conversationId], (old) => {
        return { ...old, pages: [[data.message, ...old.pages[0]], ...old.pages.slice(1)] };
      });
    });

    channel.bind('client-typing:start', (data) => { /* show indicator */ });
    channel.bind('client-typing:stop', (data) => { /* hide indicator */ });

    return () => pusher.unsubscribe(`private-chat-${conversationId}`);
  }, [conversationId]);
}
```

### Infinite Scroll (Messages)

```tsx
// useMessages.ts
function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: ({ pageParam }) =>
      chatApi.getMessages(conversationId, { cursor: pageParam, limit: 50 }),
    getNextPageParam: (lastPage) =>
      lastPage.length === 50 ? lastPage[lastPage.length - 1].createdAt : undefined,
    initialPageParam: undefined,
  });
}
```

---

## 8. Auth Endpoint: Mobile Login

Nuevo endpoint que devuelve tokens en body (no cookies):

```
POST /api/auth/mobile-login
```

```ts
// Zod schema
{
  email: z.string().email(),
  password: z.string().min(1),
  deviceInfo?: {
    platform: "ios" | "android",
    deviceName?: string,
  }
}

// Response 200:
{
  accessToken: string,
  refreshToken: string,
  user: {
    id: number,
    name: string,
    email: string,
    role: string,
    companyId: number,
    companyName: string,
    avatar?: string,
  }
}
```

Rate limited: 5 intentos/min por IP (reutiliza rate limiter existente).

---

## 9. Seguridad

| Control | Implementación |
|---------|---------------|
| Multi-tenant | Todo query filtra por `companyId`. Membership check en cada endpoint de chat. |
| Auth | `withGuards` para web, Bearer token + custom guard para mobile |
| Rate limit | Envío de mensajes: 30 msg/min por usuario (evitar spam) |
| Input | Zod validation en todos los endpoints. Content sanitizado (no HTML). |
| Push tokens | Nunca expuestos al frontend. Solo el backend envía push. |
| Tokens mobile | `expo-secure-store` (encrypted). Nunca en AsyncStorage. |
| Auditoría | `createdAt`, `senderId`, `companyId` en cada mensaje. |

---

## 10. Plan de Fases

### Fase 0 — Setup (Fundación)

- [ ] Prisma models + migration
- [ ] Crear cuenta Pusher (free tier)
- [ ] Scaffold proyecto Expo (`orvit-mobile/`)
- [ ] Endpoint `/api/auth/mobile-login`
- [ ] Endpoint `/api/chat/pusher/auth`
- [ ] Lib server Pusher (`lib/chat/pusher.ts`)

### Fase 1 — MVP (Core funcional)

- [ ] `POST /api/chat/conversations` (con DIRECT uniqueness)
- [ ] `GET /api/chat/conversations` (inbox)
- [ ] `GET /api/chat/conversations/:id/messages` (cursor pagination)
- [ ] `POST /api/chat/conversations/:id/messages` (con Pusher trigger + unread increment)
- [ ] `PATCH /api/chat/conversations/:id/read` (reset unreadCount)
- [ ] `POST /api/chat/devices/register`
- [ ] Mobile: Login screen
- [ ] Mobile: Inbox screen (con Pusher inbox channel)
- [ ] Mobile: Chat screen (con Pusher chat channel + infinite scroll)
- [ ] Push notifications (Expo Push API + token cleanup)

### Fase 2 — Enriquecimiento

- [ ] Adjuntos (fotos, archivos → S3, metadata en MessageAttachment)
- [ ] Replies (replyToId → mostrar mensaje citado)
- [ ] Menciones (@user → notificación push específica)
- [ ] Reacciones (emoji reactions)
- [ ] Search (pg_trgm full-text en messages)
- [ ] Web chat widget (componente React en orvit-v1)
- [ ] Online presence (Pusher presence channels)
- [ ] Conversation pinning

### Fase 3 — IA + Audio

- [ ] Voice messages (grabar → S3 → Whisper transcription)
- [ ] AI summary de conversaciones largas
- [ ] Smart notifications (priorizar según contexto)
- [ ] Auto-create contextual chats (al asignar OT → crear chat con asignados)
- [ ] Link previews
- [ ] Message retention cleanup cron

---

## 11. Mejoras Identificadas (Post-MVP)

1. **Unread badge global** — Tab del inbox muestra total de no leídos (suma de unreadCount)
2. **Conversation pinning** — Fijar conversaciones importantes arriba del inbox
3. **Online presence** — Indicador verde/gris via Pusher presence channels
4. **Link previews** — Detectar URLs en mensajes y mostrar preview card (og:image, og:title)
5. **Message search** — Full-text search con `pg_trgm` index sobre `Message.content`
6. **Web chat widget** — Componente React reutilizable para chatear desde orvit-v1 web
7. **Auto-create contextual chats** — Cuando se asigna una OT, auto-crear conversación con los asignados
8. **Quiet hours** — Respetar `NotificationPreferences.quietHoursStart/End` existentes para no enviar push
9. **Message retention cleanup** — Cron job que borra mensajes viejos según `retentionDays` de la conversación
10. **Read receipts visuales** — Doble tick (sent/delivered/read) calculado desde `lastReadAt` del receiver
11. **Conversation archive + restore** — Archivar conversaciones inactivas, restaurar desde inbox
12. **Expo OTA updates** — `expo-updates` para hot-fix sin rebuild completo

---

## 12. Env Vars Nuevas

```env
# Pusher
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=       # e.g. "us2"
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=

# Mobile (en orvit-mobile/.env)
EXPO_PUBLIC_API_URL=   # e.g. "https://orvit.app" o "http://192.168.x.x:3000" para dev
EXPO_PUBLIC_PUSHER_KEY=
EXPO_PUBLIC_PUSHER_CLUSTER=
```

---

## 13. Dependencias Nuevas

### Backend (orvit-v1)
```
pusher                  # Server-side Pusher SDK
expo-server-sdk         # Para enviar push notifications via Expo
```

### Mobile (orvit-mobile)
```
expo                    # Core
expo-router             # File-based routing
expo-secure-store       # Encrypted token storage
expo-notifications      # Push notification handling
expo-device             # Device info
@tanstack/react-query   # Data fetching + cache
pusher-js               # Pusher client (funciona en RN)
react-native-safe-area-context
react-native-screens
react-native-gesture-handler
```
