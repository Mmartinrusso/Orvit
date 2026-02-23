---
name: orvit-discord
description: Sistema Discord de Orvit — bot standalone en Railway, HTTP API, notificaciones, routing inteligente de tareas y agenda. Usar al trabajar con lib/discord/, discord-bot/, webhooks, TaskSession, notificaciones, task-handler o Discord bot.
---

# Discord Integration — Orvit

## Arquitectura (Standalone Bot)

```
ORVIT App (Vercel) ──HTTP POST──→ Bot Service (Railway) ──WebSocket──→ Discord
                                       ↑
Discord Users ──DMs/Interactions──→ Bot Service ──Prisma──→ Misma Supabase DB
```

**IMPORTANTE**: El bot NO corre dentro de Next.js. Es un servicio Node.js independiente.

### Estructura del bot (`discord-bot/`)
```
discord-bot/
├── src/
│   ├── index.ts               # Entry point: conecta bot + levanta HTTP server
│   ├── http-server.ts         # Express API con auth (x-api-key)
│   ├── bot/
│   │   ├── client.ts          # Discord.js client + colores/emojis
│   │   └── listeners.ts       # messageCreate + interactionCreate
│   ├── handlers/
│   │   ├── task-handler.ts    # Tareas vía Discord (texto + audio)
│   │   ├── voice-handler.ts   # Compras por voz
│   │   └── failure-voice-handler.ts  # Fallas por voz
│   ├── discord/               # voice-session, queues, matchers, components
│   ├── services/              # notifications, agenda-notifications, permissions-sync
│   ├── ai/                    # failure-extractor, purchase-extractor, config
│   └── lib/
│       ├── prisma.ts          # Singleton Prisma (misma DB que orvit)
│       └── corrective/        # priority-calculator
├── package.json
├── tsconfig.json
└── .env.example
```

### Comunicación desde ORVIT (`orvit-v1/lib/discord/`)
```
lib/discord/
├── bot-service-client.ts      # ← USAR ESTE — HTTP client al bot service
├── notifications.ts           # Funciones de notificación (usan bot-service-client)
├── agenda-notifications.ts    # Notificaciones de agenda (usan bot-service-client)
├── permissions-sync.ts        # Sync de permisos Discord (usa bot-service-client)
└── index.ts                   # Re-exports de bot-service-client
```

**⚠️ NUNCA importar `discord.js` directamente desde orvit-v1. Usar `bot-service-client.ts`.**

---

## HTTP API del Bot Service

```ts
// Todos los endpoints requieren header: x-api-key: BOT_API_KEY

// Estado
GET  /health
GET  /api/status

// Mensajes
POST /api/send-dm              // { userId, embed }
POST /api/send-channel         // { channelId, embed }
POST /api/send-notification    // { type, data, destination }
POST /api/send-bulk-dm         // { messages: [{userId, embed}] }

// Gestión
POST /api/manage-channels      // { action, guildId, ... }
POST /api/sync-permissions     // { companyId, ... }
POST /api/check-channel-access // { channelId, userId }
POST /api/guild-operations     // { operation, guildId, userId, ... }
```

### Usar desde ORVIT

```ts
import {
  sendDMViaBotService,
  sendToChannelViaBotService,
  sendNotificationViaBotService,
  getBotServiceStatus,
} from '@/lib/discord/bot-service-client';

// Enviar DM
await sendDMViaBotService(userId, embedData);

// Enviar a canal
await sendToChannelViaBotService(channelId, embedData);

// Notificación tipada
await sendNotificationViaBotService('FALLA_NUEVA', data, destination);
```

---

## Routing Inteligente: Task vs AgendaTask

```
Mensaje Discord: "tarea: llamar a Juan mañana"
         ↓
    findPersonCandidates("Juan")
         ↓
┌─────────────────┬──────────────────────────────────┐
│  Tipo persona   │  Resultado                       │
├─────────────────┼──────────────────────────────────┤
│ User (sistema)  │ prisma.task.create()             │
│                 │ → Notificación Discord al usuario │
│                 │ → Aparece en panel Tareas         │
├─────────────────┼──────────────────────────────────┤
│ Contact/externo │ prisma.agendaTask.create()        │
│                 │ → Recordatorio en Agenda          │
├─────────────────┼──────────────────────────────────┤
│ Sin asignar     │ prisma.agendaTask.create()        │
│                 │ → Recordatorio personal           │
└─────────────────┴──────────────────────────────────┘
```

---

## TaskSession — Máquina de estados

```ts
export type TaskSessionStatus =
  | 'AWAITING_AUDIO'
  | 'AWAITING_CONFIRMATION'
  | 'PROCESSING'
  | 'AWAITING_PERSON_SELECTION'
  | 'AWAITING_RESCHEDULE'
  | 'AWAITING_NEW_PERSON_NAME';
```

---

## Notificaciones

```ts
type NotificationType =
  | 'FALLA_NUEVA' | 'FALLA_RESUELTA'
  | 'OT_CREADA' | 'OT_ASIGNADA' | 'OT_COMPLETADA'
  | 'PREVENTIVO_RECORDATORIO' | 'PREVENTIVO_COMPLETADO'
  | 'RESUMEN_DIA';
```

---

## Audio — Whisper + GPT

Flujo: adjunto de audio → Whisper transcribe → GPT extrae datos estructurados → confirmación interactiva → crea Task/AgendaTask.

---

## Colores y Emojis

```ts
export const DISCORD_COLORS = {
  ERROR: 0xED4245, WARNING: 0xFEE75C, SUCCESS: 0x57F287,
  INFO: 0x5865F2, CRITICAL: 0x992D22, PREVENTIVE: 0x3498DB,
  WORK_ORDER: 0xE67E22, SUMMARY: 0x9B59B6,
};

export const DISCORD_EMOJIS = {
  FALLA: '🔴', PREVENTIVO: '🔧', OT_NUEVA: '📋',
  OT_COMPLETADA: '✅', URGENTE: '🚨', TASK: '📌', AGENDA: '📅',
};
```

---

## Variables de entorno

### Bot Service (discord-bot/.env)
```env
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=...
OPENAI_API_KEY=...
DATABASE_URL=...              # Misma DB que orvit
BOT_API_KEY=...               # Auth para requests de ORVIT
PORT=3001
```

### ORVIT (orvit-v1/.env)
```env
BOT_SERVICE_URL=https://bot.example.com   # URL del bot service en Railway
BOT_API_KEY=...                            # Mismo key que el bot
```
