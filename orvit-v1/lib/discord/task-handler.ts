/**
 * Handler de Tareas por Discord
 *
 * Procesa comandos de tareas tanto por texto como por audio:
 * - "Tarea: [descripción]" - crea tarea directamente
 * - "Tarea" (sin texto) - inicia flujo para enviar audio
 * - Audio en sesión activa - transcribe y crea tarea
 *
 * ROUTING INTELIGENTE:
 * - Si el asignado es un usuario del sistema → crea Task (tarea con feedback)
 * - Si el asignado es un contacto externo → crea AgendaTask (recordatorio)
 * - Si no hay asignado → crea AgendaTask (recordatorio personal)
 *
 * @updated 2026-01-23 - Fixed DM reactions issue
 * @updated 2026-02-18 - Smart routing: usuario→Task, contacto→AgendaTask
 */

import { prisma } from '@/lib/prisma';
import { createSession, getSession, updateSession, deleteSession } from './voice-session';
import { notifyTaskAssignedDiscord } from './notifications';

// Colores para embeds
const COLORS = {
  INFO: 0x3b82f6, // Azul
  SUCCESS: 0x10b981, // Verde
  WARNING: 0xf59e0b, // Ámbar
  ERROR: 0xef4444, // Rojo
  PROCESSING: 0x8b5cf6, // Violeta
};

/**
 * Formatea una fecha con día, fecha y hora
 * Ej: "sábado 24 de enero, 10:00 hs"
 */
function formatDueDate(date: Date): string {
  const dateStr = date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const timeStr = date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${dateStr}, ${timeStr} hs`;
}

/**
 * Calcula la distancia de Levenshtein entre dos strings
 * Útil para encontrar nombres similares con typos
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  // Inicializar matriz
  for (let i = 0; i <= bLower.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= aLower.length; j++) {
    matrix[0][j] = j;
  }

  // Llenar matriz
  for (let i = 1; i <= bLower.length; i++) {
    for (let j = 1; j <= aLower.length; j++) {
      if (bLower[i - 1] === aLower[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // sustitución
          matrix[i][j - 1] + 1,     // inserción
          matrix[i - 1][j] + 1      // eliminación
        );
      }
    }
  }

  return matrix[bLower.length][aLower.length];
}

/**
 * Compara dos nombres y determina si son similares
 * Considera: distancia Levenshtein, coincidencia de palabras parciales
 */
function areNamesSimilar(name1: string, name2: string, threshold = 3): boolean {
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();

  // Coincidencia exacta
  if (n1 === n2) return true;

  // Uno contiene al otro
  if (n1.includes(n2) || n2.includes(n1)) return true;

  // Distancia Levenshtein del nombre completo
  if (levenshteinDistance(n1, n2) <= threshold) return true;

  // Comparar por palabras: TODAS las palabras de la búsqueda deben encontrar match
  // en el candidato (evita falsos positivos por apellido compartido)
  const words1 = n1.split(/\s+/).filter(w => w.length >= 3);
  const words2 = n2.split(/\s+/).filter(w => w.length >= 3);

  if (words1.length === 0) return false;

  const allWordsMatch = words1.every(w1 =>
    words2.some(w2 => levenshteinDistance(w1, w2) <= 2)
  );

  return allWordsMatch;
}

/**
 * Función helper para manejar reacciones de forma segura en DMs
 * Discord no permite removeAll() en canales DM
 */
async function safeReact(message: any, emoji: string, clearFirst = true): Promise<void> {
  try {
    // Solo intentar removeAll si no es DM (tiene guild)
    if (clearFirst && message.guild) {
      await message.reactions.removeAll();
    }
    await message.react(emoji);
  } catch (error: any) {
    // Ignorar error 50003 (Cannot execute action on a DM channel)
    if (error.code !== 50003) {
      console.error('[TaskHandler] Error en reacción:', error);
    }
    // Intentar solo agregar la reacción si removeAll falló
    try {
      await message.react(emoji);
    } catch {
      // Ignorar si también falla
    }
  }
}

// Tipo de candidato de persona encontrada
export interface PersonCandidate {
  id: number;
  name: string;
  type: 'user' | 'contact';
  extra?: string; // email, posición, etc.
}

// Tipo de sesión para tareas
export interface TaskSession {
  type: 'TASK';
  status: 'AWAITING_AUDIO' | 'AWAITING_CONFIRMATION' | 'PROCESSING' | 'AWAITING_PERSON_SELECTION' | 'AWAITING_RESCHEDULE' | 'AWAITING_NEW_PERSON_NAME';
  userId: number;
  companyId: number;
  startedAt: Date;
  extractedData?: {
    title: string;
    description?: string;
    assigneeName?: string;
    dueDate?: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    groupName?: string | null;
  };
  // Para selección de persona cuando hay múltiples candidatos
  personCandidates?: PersonCandidate[];
  source?: 'DISCORD_TEXT' | 'DISCORD_VOICE';
  discordMessageId?: string;
  // Para reprogramación de tarea
  taskIdToReschedule?: number;
  // Nombre transcrito que no se encontró (para pedir confirmación)
  transcribedPersonName?: string;
}

/**
 * Verifica si el mensaje es un comando de tarea
 * Retorna información completa sobre el comando detectado
 */
export function isTaskCommand(
  message: any,
  botUserId?: string
): {
  isCommand: boolean;
  hasAudio: boolean;
  audioAttachment?: any;
  taskText?: string;
} {
  const content = message.content || '';
  const normalized = content.toLowerCase().trim();

  // Detectar si es comando de tarea
  const isCommand =
    normalized.startsWith('tarea:') ||
    normalized.startsWith('tarea ') ||
    normalized === 'tarea' ||
    normalized.startsWith('pedido:') ||
    normalized.startsWith('pedido ') ||
    normalized === 'pedido';

  if (!isCommand) {
    return { isCommand: false, hasAudio: false };
  }

  // Detectar audio adjunto
  const attachments = message.attachments;
  let audioAttachment = null;
  let hasAudio = false;

  if (attachments && attachments.size > 0) {
    for (const [, attachment] of attachments) {
      const contentType = attachment.contentType || '';
      if (
        contentType.startsWith('audio/') ||
        contentType === 'application/ogg' ||
        attachment.name?.endsWith('.ogg') ||
        attachment.name?.endsWith('.mp3') ||
        attachment.name?.endsWith('.m4a') ||
        attachment.name?.endsWith('.wav')
      ) {
        audioAttachment = attachment;
        hasAudio = true;
        break;
      }
    }
  }

  // Extraer texto de tarea (si hay)
  let taskText: string | undefined = undefined;
  const prefixes = ['tarea:', 'tarea ', 'pedido:', 'pedido '];
  for (const prefix of prefixes) {
    if (normalized.startsWith(prefix)) {
      const text = content.substring(prefix.length).trim();
      if (text) {
        taskText = text;
      }
      break;
    }
  }

  return {
    isCommand,
    hasAudio,
    audioAttachment,
    taskText,
  };
}

/**
 * Extrae el texto de tarea del mensaje
 */
function extractTaskText(content: string): string | null {
  const normalized = content.trim();
  const prefixes = ['tarea:', 'tarea ', 'pedido:', 'pedido '];

  for (const prefix of prefixes) {
    if (normalized.toLowerCase().startsWith(prefix)) {
      const text = normalized.substring(prefix.length).trim();
      return text || null;
    }
  }
  return null;
}

/**
 * Busca usuario por Discord ID
 */
export async function getUserByDiscordId(discordId: string) {
  return prisma.user.findFirst({
    where: { discordUserId: discordId },
    include: {
      companies: {
        include: { company: true },
        take: 1,
      },
    },
  });
}

/**
 * Extrae datos de tarea usando GPT
 */
async function extractTaskDataWithGPT(text: string): Promise<TaskSession['extractedData']> {
  try {
    // Usar OpenAI para extraer datos estructurados
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      // Fallback: usar el texto como título
      return {
        title: text.length > 100 ? text.substring(0, 97) + '...' : text,
        description: text.length > 100 ? text : undefined,
        priority: 'MEDIUM',
      };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: (() => {
              const now = new Date();
              const tzOpts: Intl.DateTimeFormatOptions = { timeZone: 'America/Argentina/Buenos_Aires', hour12: false };
              const fechaActual = now.toLocaleString('es-AR', tzOpts);
              // Calcular "mañana" en hora Argentina
              const argNow = new Date(now.toLocaleString('en-US', tzOpts));
              const mañana = new Date(argNow);
              mañana.setDate(mañana.getDate() + 1);
              mañana.setHours(12, 0, 0, 0);
              // Formatear como ISO local Argentina (sin Z para evitar conversión UTC)
              const pad = (n: number) => String(n).padStart(2, '0');
              const mañanaISO = `${mañana.getFullYear()}-${pad(mañana.getMonth()+1)}-${pad(mañana.getDate())}T12:00:00`;
              const hoyISO = `${argNow.getFullYear()}-${pad(argNow.getMonth()+1)}-${pad(argNow.getDate())}`;

              return `Sos un asistente que RESUME y ESTRUCTURA pedidos/tareas en español argentino.

FECHA/HORA ACTUAL: ${fechaActual}
HOY ES: ${hoyISO}
MAÑANA SERÁ: ${mañanaISO}

REGLAS ESTRICTAS:

1. TITLE (OBLIGATORIO): Título CORTO de 3-6 palabras. NUNCA copies el texto completo.
   Ejemplos:
   - "Necesito comprar carne, un kilo, dos kilos de pollo, se lo pido a Mariano para mañana" → "Comprar carne y pollo"
   - "Hay que revisar el presupuesto del proyecto nuevo" → "Revisar presupuesto proyecto"
   - "Llamar al cliente para confirmar la reunión de la semana que viene" → "Llamar cliente confirmar reunión"

2. DESCRIPTION: Detalles específicos (cantidades, especificaciones). Puede ser null.
   - Del ejemplo anterior: "1 kilo de carne, 2 kilos de pollo"

3. ASSIGNEENAME: Nombre de la persona a quien se le pide. Buscar patrones:
   - "a [Nombre]", "para [Nombre]", "se lo pido a [Nombre]", "pidiendo a [Nombre]"
   - "se lo estoy pidiendo a Mariano" → "Mariano"
   - Si no hay persona mencionada → null

4. DUEDATE: Fecha/hora en formato ISO 8601 (SIN zona horaria, hora local Argentina). Usar las fechas provistas arriba:
   - "para mañana" → ${mañanaISO}
   - "lo necesito para mañana" → ${mañanaISO}
   - "mañana a las 10" → ${mañanaISO.replace('T12:00:00', 'T10:00:00')}
   - "el viernes 15hs" → próximo viernes a las 15:00 (calcular desde HOY ES)
   - "urgente" → hoy en 1 hora desde FECHA/HORA ACTUAL
   - Si no hay fecha → null

5. PRIORITY: MEDIUM por defecto. URGENT si dice "urgente/ya/ahora". HIGH si dice "importante".

6. GROUPNAME: Nombre del grupo/proyecto si se menciona explícitamente. Buscar patrones:
   - "en el grupo [Nombre]", "para el grupo [Nombre]", "del proyecto [Nombre]"
   - "en [Nombre]" cuando [Nombre] suena a un proyecto o carpeta (no una persona)
   - Si no se menciona ningún grupo → null

Responde ÚNICAMENTE con JSON válido (sin markdown):
{"title":"...","description":"...o null","assigneeName":"...o null","dueDate":"${mañanaISO} o null","priority":"MEDIUM","groupName":null}`;
            })(),
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error('Error calling OpenAI');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    console.log('[TaskHandler] Texto a analizar:', text);
    console.log('[TaskHandler] Respuesta GPT:', content);

    if (content) {
      try {
        // Limpiar el contenido por si viene con ```json
        const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleanContent);

        console.log('[TaskHandler] Datos extraídos:', parsed);

        return {
          title: parsed.title || text.substring(0, 100),
          description: parsed.description,
          assigneeName: parsed.assigneeName,
          dueDate: parsed.dueDate,
          priority: parsed.priority || 'MEDIUM',
          groupName: parsed.groupName || null,
        };
      } catch (parseError) {
        console.error('[TaskHandler] Error parseando JSON de GPT:', parseError, 'Content:', content);
      }
    }
  } catch (error) {
    console.error('[TaskHandler] Error extrayendo datos con GPT:', error);
  }

  // Fallback
  return {
    title: text.length > 100 ? text.substring(0, 97) + '...' : text,
    description: text.length > 100 ? text : undefined,
    priority: 'MEDIUM',
  };
}

/**
 * Transcribe audio usando Whisper
 */
async function transcribeAudio(audioBuffer: Buffer, contentType: string): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY no configurada');
  }

  const formData = new FormData();

  // Determinar extensión del archivo
  const extension = contentType.includes('ogg')
    ? 'ogg'
    : contentType.includes('mp3')
      ? 'mp3'
      : contentType.includes('wav')
        ? 'wav'
        : 'm4a';

  const blob = new Blob([audioBuffer], { type: contentType });
  formData.append('file', blob, `audio.${extension}`);
  formData.append('model', 'whisper-1');
  formData.append('language', 'es');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error de Whisper: ${error}`);
  }

  const data = await response.json();
  return data.text || '';
}

/**
 * Descarga un attachment de Discord
 */
async function downloadAttachment(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Error descargando audio');
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Busca personas (usuarios y contactos) que coincidan con un nombre
 * Usa fuzzy matching para encontrar nombres similares con typos
 * Ej: "Marino Ruso" encontrará a "Mariano Russo" (1-2 letras de diferencia)
 */
async function findPersonCandidates(
  userId: number,
  companyId: number,
  searchName: string
): Promise<PersonCandidate[]> {
  const candidatesMap = new Map<string, PersonCandidate & { score: number }>();

  // Separar el nombre en palabras (mínimo 2 chars)
  const words = searchName
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 2);

  // Condiciones AND: el nombre debe contener TODAS las palabras (no alguna).
  // Esto evita que "Lucas Ruso" matchee "Mariano Russo" porque "Ruso" ≈ "Russo".
  // Si hay una sola palabra, AND es equivalente a OR (no hay diferencia).
  // La coincidencia fuzzy por typos la maneja la fase 2 (areNamesSimilar).
  const andConditions = words.length > 0
    ? words.map(word => ({ name: { contains: word, mode: 'insensitive' as const } }))
    : [{ name: { contains: searchName, mode: 'insensitive' as const } }];

  // Buscar en usuarios de la empresa (búsqueda exacta por substring, AND de palabras)
  const matchedUsers = await prisma.user.findMany({
    where: {
      companies: { some: { companyId } },
      AND: andConditions,
      isActive: true,
    },
    select: { id: true, name: true, email: true },
  });

  for (const user of matchedUsers) {
    const key = `user_${user.id}`;
    if (!candidatesMap.has(key)) {
      const isExact = user.name?.toLowerCase() === searchName.toLowerCase();
      candidatesMap.set(key, {
        id: user.id,
        name: user.name || 'Usuario',
        type: 'user',
        extra: user.email || undefined,
        score: isExact ? 100 : 50,
      });
    }
  }

  // Buscar en contactos del usuario (búsqueda exacta por substring, AND de palabras)
  const matchedContacts = await prisma.contact.findMany({
    where: {
      userId,
      AND: andConditions,
      isActive: true,
    },
    select: { id: true, name: true, company: true, position: true },
  });

  for (const contact of matchedContacts) {
    const key = `contact_${contact.id}`;
    if (!candidatesMap.has(key)) {
      const isExact = contact.name.toLowerCase() === searchName.toLowerCase();
      candidatesMap.set(key, {
        id: contact.id,
        name: contact.name,
        type: 'contact',
        extra: contact.company || contact.position || undefined,
        score: isExact ? 100 : 50,
      });
    }
  }

  // Búsqueda fuzzy: traer TODOS los usuarios y contactos y filtrar por similitud
  // Esto es necesario para encontrar "Mariano Russo" cuando buscan "Marino Ruso"
  const allUsers = await prisma.user.findMany({
    where: {
      companies: { some: { companyId } },
      isActive: true,
    },
    select: { id: true, name: true, email: true },
  });

  for (const user of allUsers) {
    const key = `user_${user.id}`;
    if (!candidatesMap.has(key) && user.name && areNamesSimilar(searchName, user.name)) {
      const distance = levenshteinDistance(searchName.toLowerCase(), user.name.toLowerCase());
      candidatesMap.set(key, {
        id: user.id,
        name: user.name,
        type: 'user',
        extra: user.email || undefined,
        score: Math.max(0, 40 - distance * 10), // Menor distancia = mayor score
      });
    }
  }

  const allContacts = await prisma.contact.findMany({
    where: {
      userId,
      isActive: true,
    },
    select: { id: true, name: true, company: true, position: true },
  });

  for (const contact of allContacts) {
    const key = `contact_${contact.id}`;
    if (!candidatesMap.has(key) && areNamesSimilar(searchName, contact.name)) {
      const distance = levenshteinDistance(searchName.toLowerCase(), contact.name.toLowerCase());
      candidatesMap.set(key, {
        id: contact.id,
        name: contact.name,
        type: 'contact',
        extra: contact.company || contact.position || undefined,
        score: Math.max(0, 40 - distance * 10),
      });
    }
  }

  // Convertir a array y ordenar por score
  const candidates = Array.from(candidatesMap.values())
    .sort((a, b) => b.score - a.score)
    .map(({ score, ...candidate }) => candidate); // Remover score del resultado

  console.log(`[TaskHandler] Búsqueda de "${searchName}": ${candidates.length} candidatos encontrados`);
  candidates.forEach(c => console.log(`  - ${c.name} (${c.type})`));

  return candidates;
}

// Tipo de resultado de createTask
type CreateTaskResult =
  | { success: true; task: any; needsSelection: false; needsNewPerson: false; taskType: 'task' | 'agenda' }
  | { success: false; needsSelection: true; needsNewPerson: false; candidates: PersonCandidate[]; searchedName: string }
  | { success: false; needsSelection: false; needsNewPerson: true; transcribedName: string };

/**
 * Crea una Task (sistema) o AgendaTask (agenda) según el tipo de asignado.
 *
 * ROUTING INTELIGENTE:
 * - Asignado es usuario del sistema → Task (con feedback, notificaciones)
 * - Asignado es contacto externo → AgendaTask (recordatorio)
 * - Sin asignado → AgendaTask (recordatorio personal)
 *
 * Si hay múltiples candidatos para el asignado, retorna { needsSelection: true, candidates }
 * Si no hay candidatos pero hay nombre, retorna { needsNewPerson: true } para pedir confirmación
 */
async function createTask(
  userId: number,
  companyId: number,
  data: NonNullable<TaskSession['extractedData']>,
  source: 'DISCORD_TEXT' | 'DISCORD_VOICE',
  discordMessageId?: string,
  selectedPerson?: { id: number; type: 'user' | 'contact'; name: string }
): Promise<CreateTaskResult> {
  let assignedToUserId: number | null = null;
  let assignedToContactId: number | null = null;
  let assignedToName: string | undefined = data.assigneeName;
  let resolvedPersonType: 'user' | 'contact' | null = null;

  // Si ya se seleccionó una persona específica
  if (selectedPerson) {
    resolvedPersonType = selectedPerson.type;
    if (selectedPerson.type === 'user') {
      assignedToUserId = selectedPerson.id;
    } else {
      assignedToContactId = selectedPerson.id;
    }
    assignedToName = selectedPerson.name;
  }
  // Si hay nombre pero no hay selección previa, buscar candidatos
  else if (data.assigneeName) {
    const candidates = await findPersonCandidates(userId, companyId, data.assigneeName);
    const searchNameLower = data.assigneeName.toLowerCase().trim();

    // Verificar si hay una coincidencia EXACTA
    const exactMatch = candidates.find(
      c => c.name.toLowerCase().trim() === searchNameLower
    );

    if (candidates.length > 0 && !exactMatch) {
      // Hay candidatos similares pero no exactos - preguntar al usuario
      return {
        success: false,
        needsSelection: true,
        needsNewPerson: false,
        candidates,
        searchedName: data.assigneeName,
      };
    } else if (candidates.length > 1 && exactMatch) {
      // Hay coincidencia exacta pero también otros candidatos - preguntar para confirmar
      return {
        success: false,
        needsSelection: true,
        needsNewPerson: false,
        candidates,
        searchedName: data.assigneeName,
      };
    } else if (exactMatch) {
      // Solo una coincidencia exacta - asignar directamente
      resolvedPersonType = exactMatch.type;
      if (exactMatch.type === 'user') {
        assignedToUserId = exactMatch.id;
      } else {
        assignedToContactId = exactMatch.id;
      }
      assignedToName = exactMatch.name;
    } else {
      // No hay candidatos - pedir al usuario que confirme/escriba el nombre correcto
      return {
        success: false,
        needsSelection: false,
        needsNewPerson: true,
        transcribedName: data.assigneeName,
      };
    }
  }

  // ─── RESOLVER GRUPO ───
  let resolvedGroupId: number | null = null;
  if (data.groupName) {
    try {
      const matchedGroup = await (prisma as any).taskGroup.findFirst({
        where: {
          companyId,
          isArchived: false,
          name: { contains: data.groupName, mode: 'insensitive' },
        },
        select: { id: true, name: true },
      });
      if (matchedGroup) {
        resolvedGroupId = matchedGroup.id;
        console.log(`[TaskHandler] Grupo resuelto: "${matchedGroup.name}" (id=${matchedGroup.id})`);
      } else {
        console.log(`[TaskHandler] Grupo "${data.groupName}" no encontrado, se crea sin grupo`);
      }
    } catch (err) {
      console.error('[TaskHandler] Error resolviendo grupo:', err);
    }
  }

  // ─── ROUTING INTELIGENTE ───
  // Si el asignado es un usuario del sistema → crear Task (tarea con feedback)
  // Si es contacto o sin asignar → crear AgendaTask (recordatorio/agenda)
  if (resolvedPersonType === 'user' && assignedToUserId) {
    console.log(`[TaskHandler] Routing → Task (usuario del sistema: ${assignedToName})`);

    const task = await prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        priority: data.priority,
        status: 'TODO',
        assignedToId: assignedToUserId,
        createdById: userId,
        companyId,
        tags: [],
        ...(resolvedGroupId ? { groupId: resolvedGroupId } : {}),
      },
    });

    // Enviar notificación al usuario asignado (si no es auto-asignación)
    if (assignedToUserId !== userId) {
      try {
        const { createAndSendInstantNotification } = await import('@/lib/instant-notifications');
        await createAndSendInstantNotification(
          'TASK_ASSIGNED',
          assignedToUserId,
          companyId,
          task.id,
          null,
          'Nueva tarea asignada',
          `Se te ha asignado la tarea: ${task.title}`,
          data.priority === 'URGENT' ? 'urgent' : data.priority === 'HIGH' ? 'high' : 'medium',
          {
            createdById: userId,
            priority: data.priority,
            dueDate: data.dueDate,
            taskTitle: task.title,
            source: source === 'DISCORD_VOICE' ? 'Discord (audio)' : 'Discord (texto)',
          }
        );
      } catch (notifError) {
        console.error('[TaskHandler] Error enviando notificación interna:', notifError);
      }

      // Enviar DM de Discord al asignado (si tiene Discord vinculado)
      try {
        const createdByUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });
        await notifyTaskAssignedDiscord({
          assigneeUserId: assignedToUserId,
          taskId: task.id,
          taskTitle: task.title,
          description: task.description,
          priority: data.priority || 'MEDIUM',
          dueDate: task.dueDate,
          createdByName: createdByUser?.name || 'ORVIT',
          source,
        });
      } catch (dmError) {
        console.error('[TaskHandler] Error enviando DM Discord:', dmError);
      }
    }

    // Retornar con assignedToName para el embed de confirmación
    return {
      success: true,
      task: { ...task, assignedToName },
      needsSelection: false,
      needsNewPerson: false,
      taskType: 'task',
    };
  }

  // Contacto externo o sin asignar → AgendaTask (recordatorio/agenda)
  console.log(`[TaskHandler] Routing → AgendaTask (${resolvedPersonType === 'contact' ? 'contacto externo' : 'sin asignar'})`);

  const agendaTask = await prisma.agendaTask.create({
    data: {
      title: data.title,
      description: data.description,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      priority: data.priority,
      status: 'PENDING',
      source,
      discordMessageId,
      createdById: userId,
      companyId,
      assignedToUserId,
      assignedToContactId,
      assignedToName,
      ...(resolvedGroupId ? { groupId: resolvedGroupId } : {}),
    },
  });

  return { success: true, task: agendaTask, needsSelection: false, needsNewPerson: false, taskType: 'agenda' };
}

/**
 * Construye el embed de éxito para una tarea creada.
 * Diferencia entre Task (tarea del sistema) y AgendaTask (recordatorio de agenda).
 */
function buildTaskSuccessEmbed(
  task: any,
  taskType: 'task' | 'agenda',
  options?: { prefixFields?: any[]; suffixFields?: any[] }
) {
  const isSystemTask = taskType === 'task';
  const typeLabel = isSystemTask ? '📋 Tarea del Sistema' : '📒 Recordatorio de Agenda';
  const title = isSystemTask ? '✅ Tarea Creada' : '✅ Recordatorio Creado';

  const fields = [
    ...(options?.prefixFields || []),
    ...(task.description
      ? [{ name: '📝 Descripción', value: task.description.substring(0, 200), inline: false }]
      : []),
    { name: '👤 Asignado a', value: task.assignedToName || 'Sin asignar', inline: true },
    {
      name: '📅 Vence',
      value: task.dueDate ? formatDueDate(task.dueDate) : 'Sin fecha',
      inline: true,
    },
    { name: '🎯 Prioridad', value: task.priority, inline: true },
    { name: '📌 Tipo', value: typeLabel, inline: true },
    ...(options?.suffixFields || []),
  ];

  return {
    title,
    description: `**${task.title}**`,
    color: COLORS.SUCCESS,
    fields,
    footer: { text: `${isSystemTask ? 'Tarea' : 'Agenda'} #${task.id}` },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Pide al usuario que escriba el nombre correcto de la persona
 * Se usa cuando no se encontró ningún candidato en la agenda
 */
async function askForNewPersonName(
  message: any,
  transcribedName: string,
  extractedData: NonNullable<TaskSession['extractedData']>,
  userId: number,
  companyId: number,
  source: 'DISCORD_TEXT' | 'DISCORD_VOICE'
): Promise<void> {
  // Guardar sesión esperando el nombre
  createSession(message.author.id, {
    type: 'TASK',
    status: 'AWAITING_NEW_PERSON_NAME',
    userId,
    companyId,
    startedAt: new Date(),
    extractedData,
    source,
    discordMessageId: message.id,
    transcribedPersonName: transcribedName,
  });

  await message.reply({
    embeds: [
      {
        title: '👤 Persona no encontrada',
        description: `No encontré a **"${transcribedName}"** en tu agenda.\n\n¿Cómo se escribe correctamente el nombre?\n\n_Escribí el nombre completo para agregarlo a tu agenda._`,
        color: COLORS.WARNING,
        fields: [
          { name: '📝 Tarea', value: extractedData.title, inline: false },
        ],
        footer: { text: 'Escribí "sin asignar" para crear la tarea sin persona asignada' },
      },
    ],
  });
}

/**
 * Maneja cuando el usuario escribe el nombre de una nueva persona
 */
export async function handleNewPersonName(message: any, session: TaskSession): Promise<void> {
  const content = message.content.trim();

  // Cancelar
  if (content.toLowerCase() === 'cancelar') {
    deleteSession(message.author.id);
    await message.reply({
      embeds: [
        {
          title: '❌ Cancelado',
          description: 'Se canceló la creación de la tarea.',
          color: COLORS.WARNING,
        },
      ],
    });
    return;
  }

  if (!session.extractedData) {
    deleteSession(message.author.id);
    await message.reply({
      embeds: [{ title: '❌ Error', description: 'Sesión inválida', color: COLORS.ERROR }],
    });
    return;
  }

  await message.react('⏳');

  try {
    let newContact: { id: number; name: string } | null = null;

    // Si no quiere asignar a nadie
    if (content.toLowerCase() === 'sin asignar' || content.toLowerCase() === 'nadie') {
      session.extractedData.assigneeName = undefined;
    } else {
      // Crear nuevo contacto en la agenda del usuario
      newContact = await prisma.contact.create({
        data: {
          name: content,
          userId: session.userId,
          category: 'Agenda',
          isActive: true,
        },
        select: { id: true, name: true },
      });

      console.log(`[TaskHandler] Nuevo contacto creado: ${newContact.name} (ID: ${newContact.id})`);
    }

    // Resolver grupo (si se extrajo groupName del texto original)
    let newContactGroupId: number | null = null;
    if (session.extractedData.groupName) {
      try {
        const g = await (prisma as any).taskGroup.findFirst({
          where: { companyId: session.companyId, isArchived: false, name: { contains: session.extractedData.groupName, mode: 'insensitive' } },
          select: { id: true },
        });
        if (g) newContactGroupId = g.id;
      } catch { /* ignorar */ }
    }

    // Nuevo contacto → siempre AgendaTask (recordatorio de agenda)
    const task = await prisma.agendaTask.create({
      data: {
        title: session.extractedData.title,
        description: session.extractedData.description,
        dueDate: session.extractedData.dueDate ? new Date(session.extractedData.dueDate) : null,
        priority: session.extractedData.priority,
        status: 'PENDING',
        source: session.source || 'DISCORD_TEXT',
        discordMessageId: session.discordMessageId,
        createdById: session.userId,
        companyId: session.companyId,
        assignedToContactId: newContact?.id || null,
        assignedToName: newContact?.name || undefined,
        ...(newContactGroupId ? { groupId: newContactGroupId } : {}),
      },
    });

    await safeReact(message, '✅');

    const suffixFields = newContact
      ? [{ name: '➕ Nuevo contacto', value: `"${newContact.name}" agregado a tu agenda`, inline: false }]
      : [];

    await message.reply({
      embeds: [buildTaskSuccessEmbed(task, 'agenda', { suffixFields })],
    });

    deleteSession(message.author.id);
  } catch (error) {
    console.error('[TaskHandler] Error creando tarea con nuevo contacto:', error);
    await safeReact(message, '❌');
    await message.reply({
      embeds: [
        {
          title: '❌ Error',
          description: 'Hubo un error creando la tarea. Intenta de nuevo.',
          color: COLORS.ERROR,
        },
      ],
    });
    deleteSession(message.author.id);
  }
}

/**
 * Crea tarea con persona específica ya seleccionada
 */
async function createTaskWithPerson(
  userId: number,
  companyId: number,
  data: NonNullable<TaskSession['extractedData']>,
  source: 'DISCORD_TEXT' | 'DISCORD_VOICE',
  person: PersonCandidate,
  discordMessageId?: string
) {
  return createTask(userId, companyId, data, source, discordMessageId, {
    id: person.id,
    type: person.type,
    name: person.name,
  });
}

/**
 * Muestra el select menu para elegir persona cuando hay múltiples candidatos
 */
async function showPersonSelectionMenu(
  message: any,
  candidates: PersonCandidate[],
  searchedName: string,
  extractedData: NonNullable<TaskSession['extractedData']>,
  userId: number,
  companyId: number,
  source: 'DISCORD_TEXT' | 'DISCORD_VOICE'
): Promise<void> {
  // @ts-ignore
  const discord = await import(/* webpackIgnore: true */ 'discord.js');

  // Crear opciones para el select menu (max 25)
  const options = candidates.slice(0, 25).map((candidate, index) => ({
    label: candidate.name.substring(0, 100),
    description: candidate.extra ? candidate.extra.substring(0, 100) : (candidate.type === 'user' ? 'Usuario del sistema' : 'Contacto'),
    value: `person_${candidate.type}_${candidate.id}`,
    emoji: candidate.type === 'user' ? '👤' : '📇',
  }));

  // Agregar opción para crear nuevo contacto
  options.push({
    label: `Crear nuevo: "${searchedName}"`,
    description: 'Agregar como nuevo contacto',
    value: 'person_new',
    emoji: '➕',
  });

  const row = new discord.ActionRowBuilder().addComponents(
    new discord.StringSelectMenuBuilder()
      .setCustomId('task_person_select')
      .setPlaceholder(`¿Cuál "${searchedName}"?`)
      .addOptions(options)
  );

  // Guardar sesión con los datos necesarios para cuando seleccione
  createSession(message.author.id, {
    type: 'TASK',
    status: 'AWAITING_PERSON_SELECTION',
    userId,
    companyId,
    startedAt: new Date(),
    extractedData,
    personCandidates: candidates,
    source,
    discordMessageId: message.id,
  });

  await message.reply({
    embeds: [
      {
        title: '👥 ¿A quién te referís?',
        description: `Encontré **${candidates.length} persona${candidates.length !== 1 ? 's' : ''}** similar${candidates.length !== 1 ? 'es' : ''} a "${searchedName}".\n\n¿Es alguna de estas? Si no, seleccioná "Crear nuevo".`,
        color: COLORS.INFO,
        fields: [
          { name: '📝 Tarea', value: extractedData.title, inline: false },
        ],
      },
    ],
    components: [row],
  });
}

/**
 * Handler para cuando el usuario selecciona una persona del menu
 */
export async function handlePersonSelection(
  interaction: any,
  session: TaskSession
): Promise<void> {
  // Deferir inmediatamente para evitar DiscordAPIError[10062]:
  // las interacciones tienen ventana de 3s; las ops async (DB, DM) pueden excederla.
  // deferUpdate() extiende la ventana a 15 minutos y luego editReply() actualiza el mensaje.
  await interaction.deferUpdate();

  const value = interaction.values[0];

  if (!session.extractedData) {
    await interaction.editReply({
      embeds: [{ title: '❌ Error', description: 'Sesión inválida', color: COLORS.ERROR }],
      components: [],
    });
    deleteSession(interaction.user.id);
    return;
  }

  let selectedPerson: PersonCandidate | undefined;

  if (value === 'person_new') {
    // Crear la tarea sin asignar a persona existente (usa el nombre original)
    // El nombre quedará en assignedToName pero sin assignedToUserId ni assignedToContactId
    selectedPerson = undefined;
  } else {
    // Parsear el valor: person_user_123 o person_contact_456
    const [, type, idStr] = value.split('_');
    const id = parseInt(idStr, 10);
    selectedPerson = session.personCandidates?.find(
      (c) => c.type === type && c.id === id
    );
  }

  try {
    let task: any;
    let taskType: 'task' | 'agenda' = 'agenda';

    if (selectedPerson) {
      const result = await createTaskWithPerson(
        session.userId,
        session.companyId,
        session.extractedData,
        session.source || 'DISCORD_TEXT',
        selectedPerson,
        session.discordMessageId
      );
      if (!result.success) {
        throw new Error('Error inesperado creando tarea');
      }
      task = result.task;
      taskType = result.taskType;
    } else {
      // Crear sin persona específica (nuevo contacto o nombre sin match)
      const result = await createTask(
        session.userId,
        session.companyId,
        session.extractedData,
        session.source || 'DISCORD_TEXT',
        session.discordMessageId
      );
      if (!result.success) {
        throw new Error('Error inesperado creando tarea');
      }
      task = result.task;
      taskType = result.taskType;
    }

    await interaction.editReply({
      embeds: [buildTaskSuccessEmbed(task, taskType)],
      components: [],
    });
  } catch (error) {
    console.error('[TaskHandler] Error creando tarea tras selección:', error);
    await interaction.editReply({
      embeds: [{ title: '❌ Error', description: 'Hubo un error creando la tarea.', color: COLORS.ERROR }],
      components: [],
    });
  }

  deleteSession(interaction.user.id);
}

/**
 * Maneja el comando "Tarea" inicial (sin audio)
 */
export async function handleTaskCommand(message: any): Promise<void> {
  const user = await getUserByDiscordId(message.author.id);

  if (!user) {
    await message.reply({
      embeds: [
        {
          title: '❌ Usuario no vinculado',
          description:
            'Tu cuenta de Discord no está vinculada a ORVIT.\nContacta al administrador para vincular tu cuenta.',
          color: COLORS.ERROR,
        },
      ],
    });
    return;
  }

  const companyId = user.companies[0]?.companyId;
  if (!companyId) {
    await message.reply({
      embeds: [
        {
          title: '❌ Sin empresa',
          description: 'No tienes una empresa asignada en ORVIT.',
          color: COLORS.ERROR,
        },
      ],
    });
    return;
  }

  // Verificar si hay texto de tarea en el mensaje
  const taskText = extractTaskText(message.content);

  if (taskText) {
    // Crear tarea directamente desde texto
    await message.react('⏳');

    try {
      const extractedData = await extractTaskDataWithGPT(taskText);
      const result = await createTask(user.id, companyId, extractedData, 'DISCORD_TEXT', message.id);

      // Si hay múltiples candidatos, mostrar menú de selección
      if (!result.success && result.needsSelection) {
        await safeReact(message, '👥');
        await showPersonSelectionMenu(
          message,
          result.candidates,
          result.searchedName,
          extractedData,
          user.id,
          companyId,
          'DISCORD_TEXT'
        );
        return;
      }

      // Si no se encontró la persona, pedir que escriba el nombre
      if (!result.success && result.needsNewPerson) {
        await safeReact(message, '👤');
        await askForNewPersonName(
          message,
          result.transcribedName,
          extractedData,
          user.id,
          companyId,
          'DISCORD_TEXT'
        );
        return;
      }

      const task = result.task;
      await safeReact(message, '✅');

      await message.reply({
        embeds: [buildTaskSuccessEmbed(task, result.taskType)],
      });
    } catch (error) {
      console.error('[TaskHandler] Error creando tarea desde texto:', error);
      await safeReact(message, '❌');
      await message.reply({
        embeds: [
          {
            title: '❌ Error',
            description: 'Hubo un error creando la tarea. Intenta de nuevo.',
            color: COLORS.ERROR,
          },
        ],
      });
    }
    return;
  }

  // Sin texto - iniciar flujo de audio
  createSession(message.author.id, {
    type: 'TASK',
    status: 'AWAITING_AUDIO',
    userId: user.id,
    companyId,
    startedAt: new Date(),
  });

  await message.reply({
    embeds: [
      {
        title: '📋 Nueva Tarea',
        description:
          'Envía un **audio** describiendo la tarea o escribe los detalles.\n\n' +
          'Incluye:\n' +
          '• Qué necesitas que hagan\n' +
          '• A quién se lo pedís (opcional)\n' +
          '• Cuándo lo necesitás (opcional)\n' +
          '• Si es urgente',
        color: COLORS.INFO,
        footer: { text: 'Escribe "cancelar" para cancelar' },
      },
    ],
  });
}

/**
 * Maneja audio de tarea (con o sin sesión activa)
 */
export async function handleTaskAudio(
  message: any,
  audioAttachment: any,
  session?: TaskSession
): Promise<void> {
  // Si no hay sesión, obtener datos del usuario
  let userId: number;
  let companyId: number;

  if (session) {
    userId = session.userId;
    companyId = session.companyId;
  } else {
    const user = await getUserByDiscordId(message.author.id);
    if (!user) {
      await message.reply({
        embeds: [
          {
            title: '❌ Usuario no vinculado',
            description:
              'Tu cuenta de Discord no está vinculada a ORVIT.\nContacta al administrador para vincular tu cuenta.',
            color: COLORS.ERROR,
          },
        ],
      });
      return;
    }
    userId = user.id;
    companyId = user.companies[0]?.companyId;
    if (!companyId) {
      await message.reply({
        embeds: [
          {
            title: '❌ Sin empresa',
            description: 'No tienes una empresa asignada en ORVIT.',
            color: COLORS.ERROR,
          },
        ],
      });
      return;
    }
  }

  try {
    await message.react('⏳');

    const processingReply = await message.reply({
      embeds: [
        {
          title: '⏳ Procesando audio...',
          description: 'Transcribiendo y analizando tu pedido.',
          color: COLORS.PROCESSING,
        },
      ],
    });

    // 1. Descargar audio
    const audioBuffer = await downloadAttachment(audioAttachment.url);

    // 2. Transcribir con Whisper
    const transcription = await transcribeAudio(audioBuffer, audioAttachment.contentType || 'audio/ogg');

    if (!transcription || transcription.trim().length < 5) {
      await processingReply.edit({
        embeds: [
          {
            title: '❓ Audio muy corto',
            description: 'No pude entender el audio. Por favor, describe la tarea con más detalle.',
            color: COLORS.WARNING,
          },
        ],
      });
      return;
    }

    // 3. Extraer datos con GPT
    const extractedData = await extractTaskDataWithGPT(transcription);

    // 4. Crear tarea
    const result = await createTask(
      userId,
      companyId,
      extractedData,
      'DISCORD_VOICE',
      message.id
    );

    // Si hay múltiples candidatos, mostrar menú de selección
    if (!result.success && result.needsSelection) {
      await processingReply.edit({
        embeds: [
          {
            title: '🎤 Audio transcrito',
            description: `"${transcription.substring(0, 200)}${transcription.length > 200 ? '...' : ''}"`,
            color: COLORS.INFO,
          },
        ],
      });
      await safeReact(message, '👥');
      await showPersonSelectionMenu(
        message,
        result.candidates,
        result.searchedName,
        extractedData,
        userId,
        companyId,
        'DISCORD_VOICE'
      );
      return;
    }

    // Si no se encontró la persona, pedir que escriba el nombre
    if (!result.success && result.needsNewPerson) {
      await processingReply.edit({
        embeds: [
          {
            title: '🎤 Audio transcrito',
            description: `"${transcription.substring(0, 200)}${transcription.length > 200 ? '...' : ''}"`,
            color: COLORS.INFO,
          },
        ],
      });
      await safeReact(message, '👤');
      await askForNewPersonName(
        message,
        result.transcribedName,
        extractedData,
        userId,
        companyId,
        'DISCORD_VOICE'
      );
      return;
    }

    const task = result.task;
    const taskType = result.taskType;

    // 5. Guardar log de voz (solo para AgendaTask - el VoiceTaskLog tiene FK a AgendaTask)
    if (taskType === 'agenda') {
      await prisma.voiceTaskLog.create({
        data: {
          discordUserId: message.author.id,
          discordMessageId: message.id,
          discordAttachmentId: audioAttachment.id,
          discordChannelId: message.channel.id,
          audioUrl: audioAttachment.url,
          transcription,
          status: 'COMPLETED',
          extractedData: extractedData as any,
          taskId: task.id,
          userId,
          companyId,
          processedAt: new Date(),
        },
      });
    }

    // 6. Responder con éxito
    await safeReact(message, '✅');

    const embed = buildTaskSuccessEmbed(task, taskType, {
      prefixFields: [
        { name: '🎤 Transcripción', value: transcription.substring(0, 300), inline: false },
      ],
    });

    await processingReply.edit({
      embeds: [embed],
    });

    // Limpiar sesión si existe
    deleteSession(message.author.id);
  } catch (error) {
    console.error('[TaskHandler] Error procesando audio:', error);

    await safeReact(message, '❌');

    await message.reply({
      embeds: [
        {
          title: '❌ Error',
          description: 'Hubo un error procesando tu audio. Intenta de nuevo.',
          color: COLORS.ERROR,
        },
      ],
    });

    deleteSession(message.author.id);
  }
}

/**
 * Maneja texto de tarea (invocación directa con texto)
 */
export async function handleTaskText(message: any, taskText: string): Promise<void> {
  // Obtener datos del usuario
  const user = await getUserByDiscordId(message.author.id);
  if (!user) {
    await message.reply({
      embeds: [
        {
          title: '❌ Usuario no vinculado',
          description:
            'Tu cuenta de Discord no está vinculada a ORVIT.\nContacta al administrador para vincular tu cuenta.',
          color: COLORS.ERROR,
        },
      ],
    });
    return;
  }

  const companyId = user.companies[0]?.companyId;
  if (!companyId) {
    await message.reply({
      embeds: [
        {
          title: '❌ Sin empresa',
          description: 'No tienes una empresa asignada en ORVIT.',
          color: COLORS.ERROR,
        },
      ],
    });
    return;
  }

  await message.react('⏳');

  try {
    const extractedData = await extractTaskDataWithGPT(taskText);
    const result = await createTask(
      user.id,
      companyId,
      extractedData,
      'DISCORD_TEXT',
      message.id
    );

    // Si hay múltiples candidatos, mostrar menú de selección
    if (!result.success && result.needsSelection) {
      await safeReact(message, '👥');
      await showPersonSelectionMenu(
        message,
        result.candidates,
        result.searchedName,
        extractedData,
        user.id,
        companyId,
        'DISCORD_TEXT'
      );
      return;
    }

    // Si no se encontró la persona, pedir que escriba el nombre
    if (!result.success && result.needsNewPerson) {
      await safeReact(message, '👤');
      await askForNewPersonName(
        message,
        result.transcribedName,
        extractedData,
        user.id,
        companyId,
        'DISCORD_TEXT'
      );
      return;
    }

    const task = result.task;
    await safeReact(message, '✅');

    await message.reply({
      embeds: [buildTaskSuccessEmbed(task, result.taskType)],
    });
  } catch (error) {
    console.error('[TaskHandler] Error creando tarea desde texto:', error);
    await safeReact(message, '❌');
    await message.reply({
      embeds: [
        {
          title: '❌ Error',
          description: 'Hubo un error creando la tarea. Intenta de nuevo.',
          color: COLORS.ERROR,
        },
      ],
    });
  }
}

/**
 * Maneja texto en sesión de tarea activa (usuario en flujo interactivo)
 */
export async function handleTaskTextInSession(message: any, session: TaskSession): Promise<void> {
  const content = message.content.trim().toLowerCase();

  // Cancelar
  if (content === 'cancelar') {
    deleteSession(message.author.id);
    await message.reply({
      embeds: [
        {
          title: '❌ Cancelado',
          description: 'Se canceló la creación de la tarea.',
          color: COLORS.WARNING,
        },
      ],
    });
    return;
  }

  // Tratar el texto como descripción de tarea
  await message.react('⏳');

  try {
    const extractedData = await extractTaskDataWithGPT(message.content);
    const result = await createTask(
      session.userId,
      session.companyId,
      extractedData,
      'DISCORD_TEXT',
      message.id
    );

    // Si hay múltiples candidatos, mostrar menú de selección
    if (!result.success && result.needsSelection) {
      await safeReact(message, '👥');
      await showPersonSelectionMenu(
        message,
        result.candidates,
        result.searchedName,
        extractedData,
        session.userId,
        session.companyId,
        'DISCORD_TEXT'
      );
      // La sesión se actualiza dentro de showPersonSelectionMenu
      return;
    }

    // Si no se encontró la persona, pedir que escriba el nombre
    if (!result.success && result.needsNewPerson) {
      await safeReact(message, '👤');
      await askForNewPersonName(
        message,
        result.transcribedName,
        extractedData,
        session.userId,
        session.companyId,
        'DISCORD_TEXT'
      );
      return;
    }

    const task = result.task;
    await safeReact(message, '✅');

    await message.reply({
      embeds: [buildTaskSuccessEmbed(task, result.taskType)],
    });

    deleteSession(message.author.id);
  } catch (error) {
    console.error('[TaskHandler] Error creando tarea desde texto:', error);
    await safeReact(message, '❌');
    await message.reply({
      embeds: [
        {
          title: '❌ Error',
          description: 'Hubo un error creando la tarea. Intenta de nuevo.',
          color: COLORS.ERROR,
        },
      ],
    });
  }
}

/**
 * Maneja la reprogramación de una tarea
 * El usuario escribe la nueva fecha/hora en texto natural
 */
export async function handleTaskReschedule(message: any, session: TaskSession): Promise<void> {
  const content = message.content.trim().toLowerCase();

  // Cancelar
  if (content === 'cancelar') {
    deleteSession(message.author.id);
    await message.reply({
      embeds: [
        {
          title: '❌ Cancelado',
          description: 'Se canceló la reprogramación.',
          color: COLORS.WARNING,
        },
      ],
    });
    return;
  }

  if (!session.taskIdToReschedule) {
    deleteSession(message.author.id);
    await message.reply({
      embeds: [{ title: '❌ Error', description: 'Sesión inválida', color: COLORS.ERROR }],
    });
    return;
  }

  await message.react('⏳');

  try {
    // Usar GPT para extraer la nueva fecha/hora
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      throw new Error('OpenAI no configurado');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Extrae la fecha y hora de este texto. Fecha/hora actual: ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}

Responde SOLO con JSON: {"dateTime": "ISO8601 string"}

Ejemplos:
- "mañana a las 10" → fecha de mañana 10:00
- "viernes 15hs" → próximo viernes 15:00
- "en 2 horas" → hora actual + 2 horas
- "pasado mañana a las 9" → dentro de 2 días 09:00

Si no puedes determinar fecha/hora, responde: {"error": "No entendí la fecha"}`,
          },
          { role: 'user', content: message.content },
        ],
        temperature: 0.2,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      throw new Error('Error llamando a OpenAI');
    }

    const data = await response.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');

    if (parsed.error || !parsed.dateTime) {
      await safeReact(message, '❓');
      await message.reply({
        embeds: [
          {
            title: '❓ No entendí',
            description: 'No pude interpretar la fecha/hora. Intentá de otra forma.\n\n*Ejemplos: "mañana a las 10", "viernes 15hs", "en 2 horas"*',
            color: COLORS.WARNING,
          },
        ],
      });
      return;
    }

    const newDueDate = new Date(parsed.dateTime);

    // Validar que la fecha sea futura
    if (newDueDate <= new Date()) {
      await safeReact(message, '⚠️');
      await message.reply({
        embeds: [
          {
            title: '⚠️ Fecha inválida',
            description: 'La fecha debe ser en el futuro. Intentá de nuevo.',
            color: COLORS.WARNING,
          },
        ],
      });
      return;
    }

    // Actualizar la tarea
    const updatedTask = await prisma.agendaTask.update({
      where: { id: session.taskIdToReschedule },
      data: {
        dueDate: newDueDate,
        reminder15MinSentAt: null, // Reset para que vuelva a notificar
      },
    });

    await safeReact(message, '✅');

    const formattedDate = newDueDate.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const formattedTime = newDueDate.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    await message.reply({
      embeds: [
        {
          title: '✅ Tarea Reprogramada',
          description: `**${updatedTask.title}**\n\nNuevo vencimiento:\n📅 ${formattedDate}\n⏰ ${formattedTime}`,
          color: COLORS.SUCCESS,
          footer: { text: `Tarea #${updatedTask.id} | Te recordaré 15 min antes` },
          timestamp: new Date().toISOString(),
        },
      ],
    });

    deleteSession(message.author.id);
    console.log(`[TaskHandler] Tarea #${session.taskIdToReschedule} reprogramada a ${newDueDate.toISOString()}`);
  } catch (error) {
    console.error('[TaskHandler] Error reprogramando tarea:', error);
    await safeReact(message, '❌');
    await message.reply({
      embeds: [
        {
          title: '❌ Error',
          description: 'Hubo un error reprogramando la tarea. Intenta de nuevo.',
          color: COLORS.ERROR,
        },
      ],
    });
  }
}
