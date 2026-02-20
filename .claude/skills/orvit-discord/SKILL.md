---
name: orvit-discord
description: Sistema Discord de Orvit — notificaciones, routing inteligente de tareas y agenda, bot commands. Usar al trabajar con lib/discord/, webhooks, TaskSession, notificaciones, task-handler o Discord bot.
---

# Discord Integration — Orvit

## Arquitectura

```
lib/discord/
├── client.ts          # Cliente Discord.js + colores/emojis
├── notifications.ts   # Envío de notificaciones (webhooks + bot DM)
└── task-handler.ts    # Handler completo de tareas vía Discord (1700+ líneas)
```

---

## Routing Inteligente: Task vs AgendaTask

El principio central: el mismo comando Discord crea cosas diferentes según el asignado.

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
│                 │ → No notificación interna         │
├─────────────────┼──────────────────────────────────┤
│ Sin asignar     │ prisma.agendaTask.create()        │
│                 │ → Recordatorio personal           │
└─────────────────┴──────────────────────────────────┘
```

---

## Task Detection

```ts
// isTaskCommand(content: string): boolean
// Patrones detectados:
"tarea: ...", "tarea ...", "pedido: ...", "pedido ..."
// También soporta adjuntos de audio → transcripción Whisper
```

---

## TaskSession — Máquina de estados

```ts
export type TaskSessionStatus =
  | 'AWAITING_AUDIO'            // Esperando audio
  | 'AWAITING_CONFIRMATION'     // Confirmando datos extraídos
  | 'PROCESSING'                // Procesando
  | 'AWAITING_PERSON_SELECTION' // Eligiendo entre candidatos
  | 'AWAITING_RESCHEDULE'       // Reprogramando fecha
  | 'AWAITING_NEW_PERSON_NAME'; // Creando contacto nuevo

export interface TaskSession {
  type: 'TASK';
  status: TaskSessionStatus;
  userId: number;
  companyId: number;
  startedAt: Date;
  extractedData?: {
    title: string;
    description?: string;
    assigneeName?: string;
    dueDate?: string;          // ISO string
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  };
  personCandidates?: PersonCandidate[];
  source?: 'DISCORD_TEXT' | 'DISCORD_VOICE';
  discordMessageId?: string;
}

export interface PersonCandidate {
  id: number;
  name: string;
  type: 'user' | 'contact';
  extra?: string; // email, cargo, etc.
}
```

---

## Fuzzy Matching de personas

```ts
// Usa distancia Levenshtein para manejar typos
// "Marino Ruso" → encuentra "Mariano Russo"
// Busca tanto en prisma.user como en prisma.contact
// Devuelve lista de PersonCandidate ordenada por similitud

findPersonCandidates(name: string, companyId: number): Promise<PersonCandidate[]>

// Si hay 1 candidato → asigna directamente
// Si hay 2-4 → muestra menú de selección en Discord
// Si hay 0 → pregunta si crear contacto nuevo
```

---

## Flujo de creación de Task

```ts
// createTask(session, resolvedPerson) en task-handler.ts

if (resolvedPersonType === 'user' && assignedToUserId) {
  // Sistema Task
  const task = await prisma.task.create({
    data: {
      companyId,
      title: extractedData.title,
      description: extractedData.description,
      assignedTo: assignedToUserId,
      dueDate: extractedData.dueDate,
      priority: extractedData.priority,
      status: 'PENDING',
      source: 'DISCORD',
    },
  });
  // DM al asignado con botones de acción
  await sendDiscordDM(assignedToDiscordId, buildTaskEmbed(task));
} else {
  // AgendaTask / Contacto
  const agendaTask = await prisma.agendaTask.create({
    data: {
      companyId,
      title: extractedData.title,
      assignedContactId: resolvedContactId,
      dueDate: extractedData.dueDate,
      priority: extractedData.priority,
      source: 'DISCORD',
    },
  });
}
```

---

## Audio — Whisper + GPT

```ts
// handleTaskAudio() en task-handler.ts
// 1. Descarga adjunto de Discord
// 2. Transcribe con OpenAI Whisper
// 3. Extrae datos estructurados con GPT (title, assignee, date, priority)
// 4. Confirma con el usuario vía mensaje interactivo
// 5. Crea Task o AgendaTask según resolución de persona
```

---

## Notificaciones — notifications.ts

```ts
type NotificationType =
  | 'FALLA_NUEVA'
  | 'FALLA_RESUELTA'
  | 'OT_CREADA'
  | 'OT_ASIGNADA'
  | 'OT_COMPLETADA'
  | 'PREVENTIVO_RECORDATORIO'
  | 'PREVENTIVO_COMPLETADO'
  | 'RESUMEN_DIA';

// Envío flexible: webhook URL o channel ID + bot token
// Config por sector en Prisma: discordFallasWebhook, discordOTChannelId, etc.

sendNotification(type: NotificationType, data: NotificationData, destination: string)
```

---

## Colores y Emojis

```ts
// client.ts
export const DISCORD_COLORS = {
  ERROR:      0xED4245,  // Rojo
  WARNING:    0xFEE75C,  // Amarillo
  SUCCESS:    0x57F287,  // Verde
  INFO:       0x5865F2,  // Azul Discord
  CRITICAL:   0x992D22,  // Rojo oscuro
  PREVENTIVE: 0x3498DB,  // Azul claro
  WORK_ORDER: 0xE67E22,  // Naranja
  SUMMARY:    0x9B59B6,  // Violeta
};

export const DISCORD_EMOJIS = {
  FALLA: '🔴', PREVENTIVO: '🔧', OT_NUEVA: '📋',
  OT_COMPLETADA: '✅', URGENTE: '🚨', INFO: 'ℹ️',
  WARNING: '⚠️', SUCCESS: '✅', TASK: '📌', AGENDA: '📅',
};
```

---

## Flujos interactivos

```
Selección de persona:
  Bot muestra botones numerados (1, 2, 3...) → usuario clickea → continúa

Reprogramar:
  Usuario dice "para el jueves" → GPT extrae fecha → confirma y actualiza

Nuevo contacto:
  No se encontró persona → bot pregunta nombre completo → crea Contact en Prisma
```

---

## Variables de entorno requeridas

```env
DISCORD_BOT_TOKEN=...          # Bot token para DMs y botones
DISCORD_GUILD_ID=...           # Servidor Discord
OPENAI_API_KEY=...             # Para Whisper + GPT extraction
```
