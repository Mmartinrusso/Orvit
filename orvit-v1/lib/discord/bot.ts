/**
 * Discord Bot Client
 *
 * Bot completo de Discord usando discord.js
 * Permite enviar DMs a usuarios y gestionar canales/categorías
 *
 * NOTA: Usa imports dinámicos para evitar problemas con webpack
 */

// Tipos locales para evitar importar discord.js estáticamente
type DiscordClient = any;
type DiscordGuild = any;

// Singleton del cliente de Discord (usando globalThis para hot reload)
const globalForDiscord = globalThis as unknown as {
  discordClient: DiscordClient | null;
  discordReady: boolean;
  discordModule: any;
  discordListenersRegistered: boolean;
};

let discordClient: DiscordClient | null = globalForDiscord.discordClient ?? null;
let isReady = globalForDiscord.discordReady ?? false;
let discordModule: any = globalForDiscord.discordModule ?? null;
let listenersRegistered = globalForDiscord.discordListenersRegistered ?? false;

/**
 * Carga el módulo discord.js dinámicamente
 * El comentario webpackIgnore evita que webpack intente parsear el módulo
 */
async function loadDiscordModule() {
  if (!discordModule) {
    // @ts-ignore - webpackIgnore es necesario para evitar bundling
    discordModule = await import(/* webpackIgnore: true */ 'discord.js');
    globalForDiscord.discordModule = discordModule;
  }
  return discordModule;
}

/**
 * Obtiene o crea el cliente de Discord
 */
export async function getDiscordClient(): Promise<DiscordClient> {
  if (!discordClient) {
    const discord = await loadDiscordModule();

    discordClient = new discord.Client({
      intents: [
        discord.GatewayIntentBits.Guilds,
        discord.GatewayIntentBits.GuildMessages,
        discord.GatewayIntentBits.DirectMessages,
        discord.GatewayIntentBits.GuildMembers,
        discord.GatewayIntentBits.MessageContent, // Necesario para leer texto de mensajes
      ],
      partials: [
        discord.Partials.Channel, // Necesario para recibir DMs
        discord.Partials.Message,
      ],
    });

    // Guardar en globalThis para hot reload
    globalForDiscord.discordClient = discordClient;

    // Solo registrar listeners una vez
    if (!listenersRegistered) {
      listenersRegistered = true;
      globalForDiscord.discordListenersRegistered = true;

      discordClient.on('ready', () => {
        isReady = true;
        globalForDiscord.discordReady = true;
        console.log(`✅ [Discord Bot] Conectado como ${discordClient?.user?.tag}`);
      });

      discordClient.on('error', (error: any) => {
        console.error('❌ [Discord Bot] Error:', error);
      });

      discordClient.on('disconnect', () => {
        isReady = false;
        globalForDiscord.discordReady = false;
        console.log('⚠️ [Discord Bot] Desconectado');
      });

    // Listener para mensajes (fallas por voz + pedidos de compra)
    discordClient.on('messageCreate', async (message: any) => {
      try {
        // Ignorar mensajes del bot
        if (message.author.bot) return;

        // Verificar si es DM (sin guild)
        const isDM = !message.guild;

        if (isDM) {
          console.log(`[Discord Bot] DM recibido de ${message.author.tag}: "${message.content}"`);

          // ============================================
          // MENÚ DE BIENVENIDA
          // ============================================
          const greetings = ['hola', 'hey', 'hello', 'hi', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'que tal', 'ey'];
          const messageContent = message.content.toLowerCase().trim();

          const isGreeting = greetings.some(g => messageContent === g || messageContent.startsWith(g + ' ') || messageContent.startsWith(g + '!'));

          if (isGreeting) {
            console.log(`[Discord Bot] Saludo detectado de ${message.author.tag}`);
            try {
              const discord = await loadDiscordModule();
              const { getUserByDiscordId } = await import('./task-handler');

              // Intentar obtener nombre del usuario
              let userName = message.author.username;
              try {
                const user = await getUserByDiscordId(message.author.id);
                if (user?.name) {
                  userName = user.name.split(' ')[0]; // Solo primer nombre
                }
              } catch (e) {
                console.log(`[Discord Bot] No se pudo obtener usuario de BD, usando username de Discord`);
              }

              // Crear menú select
              const row = new discord.ActionRowBuilder().addComponents(
                new discord.StringSelectMenuBuilder()
                  .setCustomId('menu_principal')
                  .setPlaceholder('¿Qué querés hacer?')
                  .addOptions([
                    {
                      label: 'Reportar Falla',
                      description: 'Reportar un problema de máquina por voz',
                      value: 'menu_reportar_falla',
                      emoji: '⚠️',
                    },
                    {
                      label: 'Crear OT',
                      description: 'Crear orden de trabajo directamente',
                      value: 'menu_crear_ot',
                      emoji: '🔧',
                    },
                    {
                      label: 'Nueva Tarea',
                      description: 'Crear tarea o recordatorio',
                      value: 'menu_nueva_tarea',
                      emoji: '📝',
                    },
                    {
                      label: 'Ayuda',
                      description: 'Ver comandos disponibles',
                      value: 'menu_ayuda',
                      emoji: '❓',
                    },
                  ]),
              );

              await message.reply({
                embeds: [{
                  title: `👋 ¡Hola ${userName}!`,
                  description: 'Soy el asistente de **ORVIT**. ¿En qué puedo ayudarte hoy?',
                  color: 0x6366f1,
                  footer: { text: 'Seleccioná una opción del menú' },
                }],
                components: [row],
              });
              console.log(`[Discord Bot] Menú de bienvenida enviado a ${message.author.tag}`);
              return;
            } catch (error) {
              console.error(`[Discord Bot] Error enviando menú de bienvenida:`, error);
            }
          }

          // Importar handler de fallas dinámicamente
          const {
            shouldProcessAsFailureFlow,
            handleFailureCommand,
            handleOTCommand,
            handleFailureAudio,
            handleMachineClarification,
            handleSectorSelection,
            handlePostFailureResponse,
            handleSolutionResponse,
            handleTechnicianSelection,
            handleCancelCommand,
            initializeFailureVoiceHandler,
          } = await import('./failure-voice-handler');
          const { getSession } = await import('./voice-session');

          // Inicializar handler si no está inicializado
          initializeFailureVoiceHandler();

          // Verificar flujo de fallas
          const failureCheck = shouldProcessAsFailureFlow(message, discordClient?.user?.id);

          // Comando "cancelar"
          if (failureCheck.isCancelCommand && failureCheck.hasActiveSession) {
            await handleCancelCommand(message);
            return;
          }

          // Comando "Falla" (sin audio)
          if (failureCheck.isFailureCommand && !failureCheck.hasAudio) {
            console.log(`[Discord Bot] Comando Falla recibido de ${message.author.tag}`);
            await handleFailureCommand(message);
            return;
          }

          // Comando "OT" (sin audio)
          if (failureCheck.isOTCommand && !failureCheck.hasAudio) {
            console.log(`[Discord Bot] Comando OT recibido de ${message.author.tag}`);
            await handleOTCommand(message);
            return;
          }

          // Sesión activa
          const session = getSession(message.author.id);

          // Debug: log de sesión y audio
          console.log(`[Discord Bot] Debug - userId: ${message.author.id}, hasSession: ${!!session}, sessionType: ${session?.type}, sessionStatus: ${session?.status}, hasAudio: ${failureCheck.hasAudio}`);

          if (session) {
            // Selección de sector (cuando usuario tiene múltiples sectores)
            if (session.status === 'AWAITING_SECTOR') {
              console.log(`[Discord Bot] Selección de sector de ${message.author.tag}`);
              await handleSectorSelection(message, session);
              return;
            }

            // Audio en sesión AWAITING_AUDIO (FAILURE o WORK_ORDER, TASK se maneja más abajo)
            if (session.status === 'AWAITING_AUDIO' && (session.type === 'FAILURE' || session.type === 'WORK_ORDER') && failureCheck.hasAudio) {
              console.log(`[Discord Bot] Audio de ${session.type === 'WORK_ORDER' ? 'OT' : 'falla'} recibido de ${message.author.tag}`);
              await handleFailureAudio(message, failureCheck.audioAttachment, session);
              return;
            }

            // Respuesta de clarificación
            if (session.status === 'CLARIFICATION_NEEDED') {
              console.log(`[Discord Bot] Clarificación de máquina de ${message.author.tag}`);
              await handleMachineClarification(message, session);
              return;
            }

            // Respuesta post-falla (solucionado / crear OT)
            if (session.status === 'POST_FAILURE') {
              console.log(`[Discord Bot] Respuesta post-falla de ${message.author.tag}`);
              await handlePostFailureResponse(message, session);
              return;
            }

            // Respuesta con descripción de solución
            if (session.status === 'AWAITING_SOLUTION') {
              console.log(`[Discord Bot] Descripción de solución de ${message.author.tag}`);
              await handleSolutionResponse(message, session);
              return;
            }

            // Selección de técnico para OT
            if (session.status === 'AWAITING_TECHNICIAN') {
              console.log(`[Discord Bot] Selección de técnico de ${message.author.tag}`);
              await handleTechnicianSelection(message, session);
              return;
            }
          }

          // ============================================
          // FLUJO DE TAREAS DE AGENDA
          // ============================================
          const {
            isTaskCommand,
            handleTaskCommand,
            handleTaskAudio,
            handleTaskText,
            handleTaskTextInSession,
          } = await import('./task-handler');

          // Verificar si hay sesión de tarea activa
          const taskSession = session?.type === 'TASK' ? session : null;

          if (taskSession && taskSession.status === 'AWAITING_AUDIO') {
            // Usuario en flujo de tarea esperando audio/texto
            const attachments = message.attachments;
            let audioAttachmentFound = null;

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
                  audioAttachmentFound = attachment;
                  break;
                }
              }
            }

            if (audioAttachmentFound) {
              console.log(`[Discord Bot] Audio de tarea recibido de ${message.author.tag}`);
              await handleTaskAudio(message, audioAttachmentFound, taskSession);
              return;
            } else {
              // Es texto en sesión de tarea
              console.log(`[Discord Bot] Texto de tarea recibido de ${message.author.tag}`);
              await handleTaskTextInSession(message, taskSession);
              return;
            }
          }

          // Sesión de reprogramación de tarea
          if (taskSession && taskSession.status === 'AWAITING_RESCHEDULE') {
            const { handleTaskReschedule } = await import('./task-handler');
            console.log(`[Discord Bot] Texto de reprogramación recibido de ${message.author.tag}`);
            await handleTaskReschedule(message, taskSession);
            return;
          }

          // Sesión esperando nombre de nueva persona
          if (taskSession && taskSession.status === 'AWAITING_NEW_PERSON_NAME') {
            const { handleNewPersonName } = await import('./task-handler');
            console.log(`[Discord Bot] Nombre de persona recibido de ${message.author.tag}`);
            await handleNewPersonName(message, taskSession);
            return;
          }

          // Detectar nuevo comando de tarea
          const taskCheck = isTaskCommand(message, discordClient?.user?.id);

          if (taskCheck.isCommand) {
            console.log(`[Discord Bot] Comando de tarea detectado de ${message.author.tag}`);

            if (taskCheck.hasAudio && taskCheck.audioAttachment) {
              // Tarea por audio
              await handleTaskAudio(message, taskCheck.audioAttachment);
            } else if (taskCheck.taskText) {
              // Tarea por texto
              await handleTaskText(message, taskCheck.taskText);
            } else {
              // Solo "Tarea" sin contenido - pedir audio o texto
              await handleTaskCommand(message);
            }
            return;
          }
        }

        // Flujo existente: pedidos de compra por voz (requiere mención + audio)
        const { shouldProcessMessage, handleVoicePurchaseCommand } = await import('./voice-handler');

        const { shouldProcess, audioAttachment, reason } = shouldProcessMessage(
          message,
          discordClient?.user?.id
        );

        if (!shouldProcess) {
          return; // No es un mensaje relevante
        }

        console.log(`[Discord Bot] Procesando pedido de compra por voz de ${message.author.tag}`);

        await handleVoicePurchaseCommand(message, audioAttachment);
      } catch (error: any) {
        console.error('[Discord Bot] Error en listener de mensajes:', error);
      }
    });

    // Listener para interacciones (botones y select menus)
    discordClient.on('interactionCreate', async (interaction: any) => {
      try {
        // Solo manejar botones y select menus
        if (!interaction.isButton() && !interaction.isStringSelectMenu()) {
          return;
        }

        const customId = interaction.customId;

        // ============================================
        // MENÚ PRINCIPAL - Select Menu y Botones
        // ============================================
        if (customId.startsWith('menu_')) {
          const discord = await loadDiscordModule();

          // Handler para el select menu principal
          if (customId === 'menu_principal' && interaction.isStringSelectMenu()) {
            const selectedValue = interaction.values[0];

            // Redirigir según la opción seleccionada
            if (selectedValue === 'menu_reportar_falla') {
              const { handleFailureCommandFromInteraction } = await import('./failure-voice-handler');
              await handleFailureCommandFromInteraction(interaction);
              return;
            }

            if (selectedValue === 'menu_crear_ot') {
              const { handleOTCommandFromInteraction } = await import('./failure-voice-handler');
              await handleOTCommandFromInteraction(interaction);
              return;
            }

            if (selectedValue === 'menu_nueva_tarea') {
              // Redirigir al flujo de nueva tarea
              const { createSession } = await import('./voice-session');
              const { getUserByDiscordId } = await import('./task-handler');

              const user = await getUserByDiscordId(interaction.user.id);

              if (!user) {
                await interaction.update({
                  embeds: [{
                    title: '❌ Usuario no vinculado',
                    description: 'Tu cuenta de Discord no está vinculada a ORVIT.\nContacta al administrador para vincular tu cuenta.',
                    color: 0xef4444,
                  }],
                  components: [],
                });
                return;
              }

              const companyId = user.companies[0]?.companyId;
              if (!companyId) {
                await interaction.update({
                  embeds: [{
                    title: '❌ Sin empresa',
                    description: 'No tienes una empresa asignada en ORVIT.',
                    color: 0xef4444,
                  }],
                  components: [],
                });
                return;
              }

              createSession(interaction.user.id, {
                companyId,
                userId: user.id,
                status: 'AWAITING_TEXT',
                type: 'TASK',
              });

              await interaction.update({
                embeds: [{
                  title: '📝 Nueva Tarea',
                  description: 'Escribí o dictá por audio la tarea que querés crear.\n\n**Ejemplo:**\n*"Recordarle a Juan que revise el informe mañana a las 10"*',
                  color: 0x6366f1,
                  footer: { text: 'Esperando tu mensaje...' },
                }],
                components: [],
              });
              return;
            }

            if (selectedValue === 'menu_mis_tareas') {
              const { getUserByDiscordId, getUserPendingTasks, formatTasksEmbed } = await import('./task-handler');

              const user = await getUserByDiscordId(interaction.user.id);

              if (!user) {
                await interaction.update({
                  embeds: [{
                    title: '❌ Usuario no vinculado',
                    description: 'Tu cuenta de Discord no está vinculada a ORVIT.',
                    color: 0xef4444,
                  }],
                  components: [],
                });
                return;
              }

              const tasks = await getUserPendingTasks(user.id);
              const embed = formatTasksEmbed(tasks, user.name || interaction.user.username);

              await interaction.update({
                embeds: [embed],
                components: [],
              });
              return;
            }

            if (selectedValue === 'menu_ayuda') {
              await interaction.update({
                embeds: [{
                  title: '❓ Ayuda - Comandos Disponibles',
                  description: 'Podés interactuar conmigo de estas formas:',
                  color: 0x6366f1,
                  fields: [
                    {
                      name: '👋 Saludos',
                      value: '`hola`, `hey`, `buenas` - Muestra este menú',
                      inline: false,
                    },
                    {
                      name: '⚠️ Fallas',
                      value: '`falla` + audio - Reporta un problema de máquina',
                      inline: false,
                    },
                    {
                      name: '🔧 Órdenes de Trabajo',
                      value: '`ot` + audio - Crea una OT directamente',
                      inline: false,
                    },
                    {
                      name: '📝 Tareas',
                      value: '`tarea` + texto/audio - Crea recordatorios',
                      inline: false,
                    },
                  ],
                  footer: { text: 'También podés saludarme con "hola" para ver el menú' },
                }],
                components: [],
              });
              return;
            }
          }

          if (customId === 'menu_nueva_tarea') {
            // Crear sesión directamente para recibir audio o texto
            const { createSession } = await import('./voice-session');
            const { getUserByDiscordId } = await import('./task-handler');

            const user = await getUserByDiscordId(interaction.user.id);

            if (!user) {
              await interaction.update({
                embeds: [{
                  title: '❌ Usuario no vinculado',
                  description: 'Tu cuenta de Discord no está vinculada a ORVIT.\nContacta al administrador para vincular tu cuenta.',
                  color: 0xef4444,
                }],
                components: [
                  new discord.ActionRowBuilder().addComponents(
                    new discord.ButtonBuilder()
                      .setCustomId('menu_volver')
                      .setLabel('← Volver')
                      .setStyle(discord.ButtonStyle.Secondary),
                  ),
                ],
              });
              return;
            }

            const companyId = user.companies[0]?.companyId;
            if (!companyId) {
              await interaction.update({
                embeds: [{
                  title: '❌ Sin empresa',
                  description: 'No tienes una empresa asignada en ORVIT.',
                  color: 0xef4444,
                }],
                components: [
                  new discord.ActionRowBuilder().addComponents(
                    new discord.ButtonBuilder()
                      .setCustomId('menu_volver')
                      .setLabel('← Volver')
                      .setStyle(discord.ButtonStyle.Secondary),
                  ),
                ],
              });
              return;
            }

            // Crear sesión de tarea esperando audio o texto
            createSession(interaction.user.id, {
              discordUserId: interaction.user.id,
              userId: user.id,
              companyId,
              status: 'AWAITING_AUDIO',
              type: 'TASK',
              createdAt: new Date(),
            });

            await interaction.update({
              embeds: [{
                title: '📝 Nueva Tarea',
                description: 'Enviá un **audio** o escribí la tarea directamente.\n\nPodés incluir:\n• Qué hay que hacer\n• Para quién es\n• Cuándo vence\n• Qué prioridad tiene\n\n*Ej: "Revisar presupuesto para Juan antes del viernes"*',
                color: 0x6366f1,
                footer: { text: 'Escribe "cancelar" para cancelar' },
              }],
              components: [],
            });

            console.log(`[Discord Bot] Sesión de tarea creada para ${interaction.user.tag}`);
            return;
          }

          if (customId === 'menu_mis_tareas') {
            // Mostrar tareas pendientes
            const { getUserByDiscordId } = await import('./task-handler');
            const { prisma } = await import('@/lib/prisma');

            const user = await getUserByDiscordId(interaction.user.id);

            if (!user) {
              await interaction.update({
                embeds: [{
                  title: '❌ Usuario no vinculado',
                  description: 'Tu cuenta de Discord no está vinculada a ORVIT.\nContacta al administrador para vincular tu cuenta.',
                  color: 0xef4444,
                }],
                components: [
                  new discord.ActionRowBuilder().addComponents(
                    new discord.ButtonBuilder()
                      .setCustomId('menu_volver')
                      .setLabel('← Volver')
                      .setStyle(discord.ButtonStyle.Secondary),
                  ),
                ],
              });
              return;
            }

            const companyId = user.companies[0]?.companyId;
            if (!companyId) {
              await interaction.update({
                embeds: [{
                  title: '❌ Sin empresa',
                  description: 'No tienes una empresa asignada en ORVIT.',
                  color: 0xef4444,
                }],
                components: [
                  new discord.ActionRowBuilder().addComponents(
                    new discord.ButtonBuilder()
                      .setCustomId('menu_volver')
                      .setLabel('← Volver')
                      .setStyle(discord.ButtonStyle.Secondary),
                  ),
                ],
              });
              return;
            }

            // Obtener tareas pendientes del usuario
            const tasks = await prisma.agendaTask.findMany({
              where: {
                createdById: user.id,
                companyId,
                status: { in: ['PENDING', 'IN_PROGRESS', 'WAITING'] },
              },
              orderBy: [
                { dueDate: 'asc' },
                { priority: 'desc' },
              ],
              take: 10,
            });

            if (tasks.length === 0) {
              await interaction.update({
                embeds: [{
                  title: '📋 Mis Tareas',
                  description: '¡No tienes tareas pendientes! 🎉\n\nUsa el botón "Nueva Tarea" para crear una.',
                  color: 0x10b981,
                }],
                components: [
                  new discord.ActionRowBuilder().addComponents(
                    new discord.ButtonBuilder()
                      .setCustomId('menu_nueva_tarea')
                      .setLabel('📝 Nueva Tarea')
                      .setStyle(discord.ButtonStyle.Primary),
                    new discord.ButtonBuilder()
                      .setCustomId('menu_volver')
                      .setLabel('← Volver')
                      .setStyle(discord.ButtonStyle.Secondary),
                  ),
                ],
              });
              return;
            }

            const priorityEmoji: Record<string, string> = {
              'URGENT': '🔴',
              'HIGH': '🟠',
              'MEDIUM': '🟡',
              'LOW': '🟢',
            };

            const taskList = tasks.map((task: any, i: number) => {
              const emoji = priorityEmoji[task.priority] || '⚪';
              const dueStr = task.dueDate
                ? new Date(task.dueDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
                : 'Sin fecha';
              const assignee = task.assignedToName || 'Sin asignar';
              return `${emoji} **${task.title}**\n   └ ${assignee} • ${dueStr}`;
            }).join('\n\n');

            await interaction.update({
              embeds: [{
                title: `📋 Mis Tareas Pendientes (${tasks.length})`,
                description: taskList,
                color: 0x6366f1,
                footer: { text: 'Mostrando hasta 10 tareas más recientes' },
              }],
              components: [
                new discord.ActionRowBuilder().addComponents(
                  new discord.ButtonBuilder()
                    .setCustomId('menu_nueva_tarea')
                    .setLabel('📝 Nueva Tarea')
                    .setStyle(discord.ButtonStyle.Primary),
                  new discord.ButtonBuilder()
                    .setCustomId('menu_volver')
                    .setLabel('← Volver')
                    .setStyle(discord.ButtonStyle.Secondary),
                ),
              ],
            });
            return;
          }

          if (customId === 'menu_reportar_falla') {
            // Iniciar flujo de falla
            await interaction.update({
              embeds: [{
                title: '⚠️ Reportar Falla',
                description: '¿Cómo quieres reportar la falla?',
                color: 0xef4444,
                fields: [
                  {
                    name: '🎙️ Por Audio',
                    value: 'Escribe `Falla` y luego envía un mensaje de voz describiendo el problema.\n\n*"Falla en la inyectora 3, se trabó el molde"*',
                    inline: false,
                  },
                ],
                footer: { text: 'El bot detectará la máquina y creará el registro automáticamente' },
              }],
              components: [
                new discord.ActionRowBuilder().addComponents(
                  new discord.ButtonBuilder()
                    .setCustomId('menu_iniciar_falla')
                    .setLabel('🎙️ Comenzar reporte')
                    .setStyle(discord.ButtonStyle.Danger),
                  new discord.ButtonBuilder()
                    .setCustomId('menu_volver')
                    .setLabel('← Volver')
                    .setStyle(discord.ButtonStyle.Secondary),
                ),
              ],
            });
            return;
          }

          if (customId === 'menu_iniciar_falla') {
            // Usar el mismo flujo completo que el comando "Falla" directo
            const { handleFailureCommandFromInteraction } = await import('./failure-voice-handler');
            await handleFailureCommandFromInteraction(interaction);
            return;
          }

          if (customId === 'menu_ayuda') {
            await interaction.update({
              embeds: [{
                title: '❓ Ayuda - Comandos Disponibles',
                description: 'Estos son los comandos que puedo entender:',
                color: 0x06b6d4,
                fields: [
                  {
                    name: '📝 Tareas',
                    value: '`Tarea: [descripción]` - Crear tarea por texto\n`Tarea` + audio - Crear tarea por voz',
                    inline: false,
                  },
                  {
                    name: '⚠️ Fallas',
                    value: '`Falla` + audio - Reportar falla de máquina',
                    inline: false,
                  },
                  {
                    name: '🛒 Pedidos',
                    value: 'Mencióname (@bot) + audio - Crear pedido de compra',
                    inline: false,
                  },
                  {
                    name: '❌ Cancelar',
                    value: '`cancelar` - Cancela el flujo actual',
                    inline: false,
                  },
                ],
                footer: { text: 'También puedes saludarme con "hola" para ver este menú' },
              }],
              components: [
                new discord.ActionRowBuilder().addComponents(
                  new discord.ButtonBuilder()
                    .setCustomId('menu_volver')
                    .setLabel('← Volver')
                    .setStyle(discord.ButtonStyle.Secondary),
                ),
              ],
            });
            return;
          }

          if (customId === 'menu_volver') {
            // Volver al menú principal
            const { getUserByDiscordId } = await import('./task-handler');

            let userName = interaction.user.username;
            try {
              const user = await getUserByDiscordId(interaction.user.id);
              if (user?.name) {
                userName = user.name.split(' ')[0];
              }
            } catch {}

            const row = new discord.ActionRowBuilder().addComponents(
              new discord.ButtonBuilder()
                .setCustomId('menu_nueva_tarea')
                .setLabel('📝 Nueva Tarea')
                .setStyle(discord.ButtonStyle.Primary),
              new discord.ButtonBuilder()
                .setCustomId('menu_mis_tareas')
                .setLabel('📋 Mis Tareas')
                .setStyle(discord.ButtonStyle.Secondary),
              new discord.ButtonBuilder()
                .setCustomId('menu_reportar_falla')
                .setLabel('⚠️ Reportar Falla')
                .setStyle(discord.ButtonStyle.Danger),
              new discord.ButtonBuilder()
                .setCustomId('menu_ayuda')
                .setLabel('❓ Ayuda')
                .setStyle(discord.ButtonStyle.Secondary),
            );

            await interaction.update({
              embeds: [{
                title: `👋 ¡Hola ${userName}!`,
                description: 'Soy el asistente de **ORVIT**. ¿En qué puedo ayudarte hoy?',
                color: 0x6366f1,
                fields: [
                  {
                    name: '📝 Agenda',
                    value: 'Crea tareas y recordatorios para tu equipo',
                    inline: true,
                  },
                  {
                    name: '⚠️ Fallas',
                    value: 'Reporta problemas de máquinas por voz',
                    inline: true,
                  },
                ],
                footer: { text: 'Selecciona una opción o escribe directamente' },
              }],
              components: [row],
            });
            return;
          }
        }

        // ============================================
        // SELECCIÓN DE PERSONA PARA TAREA
        // ============================================
        if (customId === 'task_person_select') {
          const { getSession } = await import('./voice-session');
          const { handlePersonSelection } = await import('./task-handler');

          const session = getSession(interaction.user.id);

          if (!session || session.type !== 'TASK' || session.status !== 'AWAITING_PERSON_SELECTION') {
            await interaction.update({
              embeds: [{
                title: '⚠️ Sesión expirada',
                description: 'La sesión ha expirado. Por favor, inicia una nueva tarea.',
                color: 0xf59e0b,
              }],
              components: [],
            });
            return;
          }

          await handlePersonSelection(interaction, session);
          return;
        }

        // ============================================
        // ACCIONES DE TAREA (desde notificación de vencimiento)
        // ============================================
        if (customId.startsWith('task_complete_') || customId.startsWith('task_reschedule_') || customId.startsWith('task_snooze_')) {
          const { prisma } = await import('@/lib/prisma');
          const discord = await loadDiscordModule();

          const taskId = parseInt(customId.split('_').pop() || '0', 10);

          if (!taskId) {
            await interaction.reply({ content: '❌ Error: ID de tarea inválido', ephemeral: true });
            return;
          }

          const task = await prisma.agendaTask.findUnique({ where: { id: taskId } });

          if (!task) {
            await interaction.reply({ content: '❌ Tarea no encontrada', ephemeral: true });
            return;
          }

          // COMPLETAR TAREA
          if (customId.startsWith('task_complete_')) {
            await prisma.agendaTask.update({
              where: { id: taskId },
              data: {
                status: 'COMPLETED',
                completedAt: new Date(),
              },
            });

            await interaction.update({
              embeds: [{
                title: '✅ ¡Tarea Completada!',
                description: `**${task.title}**\n\nMarcada como completada.`,
                color: 0x10b981,
                footer: { text: `Tarea #${taskId}` },
                timestamp: new Date().toISOString(),
              }],
              components: [],
            });
            console.log(`[Discord Bot] Tarea #${taskId} completada desde notificación`);
            return;
          }

          // POSPONER 30 MIN
          if (customId.startsWith('task_snooze_')) {
            const newDueDate = new Date(Date.now() + 30 * 60 * 1000);

            await prisma.agendaTask.update({
              where: { id: taskId },
              data: {
                dueDate: newDueDate,
                reminder15MinSentAt: null, // Reset para que vuelva a notificar
              },
            });

            const timeStr = newDueDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

            await interaction.update({
              embeds: [{
                title: '⏰ Tarea Pospuesta',
                description: `**${task.title}**\n\nNuevo vencimiento: **${timeStr}**\nTe recordaré 15 min antes.`,
                color: 0x6366f1,
                footer: { text: `Tarea #${taskId}` },
                timestamp: new Date().toISOString(),
              }],
              components: [],
            });
            console.log(`[Discord Bot] Tarea #${taskId} pospuesta a ${timeStr}`);
            return;
          }

          // REPROGRAMAR - Pedir nueva fecha/hora
          if (customId.startsWith('task_reschedule_')) {
            const { createSession } = await import('./voice-session');

            // Crear sesión para reprogramar
            createSession(interaction.user.id, {
              type: 'TASK',
              status: 'AWAITING_RESCHEDULE' as any,
              userId: task.createdById,
              companyId: task.companyId,
              startedAt: new Date(),
              taskIdToReschedule: taskId,
            } as any);

            await interaction.update({
              embeds: [{
                title: '📅 Reprogramar Tarea',
                description: `**${task.title}**\n\nEscribí la nueva fecha y hora.\n\n*Ejemplos:*\n• "mañana a las 10"\n• "viernes 15hs"\n• "en 2 horas"`,
                color: 0x6366f1,
                footer: { text: 'Escribe "cancelar" para cancelar' },
              }],
              components: [],
            });
            console.log(`[Discord Bot] Iniciando reprogramación de tarea #${taskId}`);
            return;
          }
        }

        // Importar handler de interacciones dinámicamente
        const { handleFailureInteraction } = await import('./failure-voice-handler');

        const handled = await handleFailureInteraction(interaction);

        if (!handled) {
          console.log(`[Discord Bot] Interacción no manejada: ${interaction.customId}`);
        }
      } catch (error: any) {
        console.error('[Discord Bot] Error en listener de interacciones:', error);

        // Intentar responder con error
        try {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: '❌ Ocurrió un error procesando tu selección.',
              ephemeral: true,
            });
          }
        } catch {
          // Ignorar si no se puede responder
        }
      }
    });
    } // Fin de if (!listenersRegistered)
  }

  return discordClient;
}

/**
 * Conecta el bot a Discord
 */
export async function connectBot(token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await getDiscordClient();

    if (isReady) {
      return { success: true };
    }

    await client.login(token);

    // Esperar a que esté listo (máximo 10 segundos)
    const timeout = 10000;
    const startTime = Date.now();

    while (!isReady && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!isReady) {
      return { success: false, error: 'Timeout esperando conexión del bot' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('❌ [Discord Bot] Error al conectar:', error);
    return { success: false, error: error.message || 'Error al conectar bot' };
  }
}

/**
 * Desconecta el bot de Discord
 */
export async function disconnectBot(): Promise<void> {
  if (discordClient) {
    discordClient.destroy();
    discordClient = null;
    isReady = false;
    console.log('🔌 [Discord Bot] Desconectado');
  }
}

/**
 * Verifica si el bot está conectado y listo
 */
export function isBotReady(): boolean {
  return isReady && discordClient !== null;
}

/**
 * Obtiene información del bot
 */
export function getBotInfo(): {
  connected: boolean;
  username?: string;
  guilds?: number;
  userId?: string;
} {
  if (!isReady || !discordClient?.user) {
    return { connected: false };
  }

  return {
    connected: true,
    username: discordClient.user.tag,
    userId: discordClient.user.id,
    guilds: discordClient.guilds.cache.size,
  };
}

// ============================================
// FUNCIONES DE MENSAJES DIRECTOS (DM)
// ============================================

export interface DMButtonOption {
  customId: string;
  label: string;
  style: 'primary' | 'secondary' | 'success' | 'danger';
  emoji?: string;
}

export interface DMMessageOptions {
  content?: string;
  embed?: {
    title?: string;
    description?: string;
    color?: number;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    footer?: string;
    timestamp?: boolean;
  };
  buttons?: DMButtonOption[];
}

/**
 * Envía un mensaje directo a un usuario por su ID de Discord
 */
export async function sendDM(
  discordUserId: string,
  options: DMMessageOptions
): Promise<{ success: boolean; error?: string }> {
  if (!isBotReady() || !discordClient) {
    return { success: false, error: 'Bot no está conectado' };
  }

  try {
    const discord = await loadDiscordModule();
    const user = await discordClient.users.fetch(discordUserId);

    if (!user) {
      return { success: false, error: 'Usuario no encontrado' };
    }

    const messagePayload: any = {};

    if (options.content) {
      messagePayload.content = options.content;
    }

    if (options.embed) {
      const embed = new discord.EmbedBuilder();

      if (options.embed.title) embed.setTitle(options.embed.title);
      if (options.embed.description) embed.setDescription(options.embed.description);
      if (options.embed.color) embed.setColor(options.embed.color);
      if (options.embed.fields) {
        options.embed.fields.forEach((field: any) => {
          embed.addFields({ name: field.name, value: field.value, inline: field.inline });
        });
      }
      if (options.embed.footer) embed.setFooter({ text: options.embed.footer });
      if (options.embed.timestamp) embed.setTimestamp();

      messagePayload.embeds = [embed];
    }

    // Agregar botones si se especifican
    if (options.buttons && options.buttons.length > 0) {
      const styleMap: Record<string, number> = {
        primary: discord.ButtonStyle.Primary,
        secondary: discord.ButtonStyle.Secondary,
        success: discord.ButtonStyle.Success,
        danger: discord.ButtonStyle.Danger,
      };

      const row = new discord.ActionRowBuilder();
      for (const btn of options.buttons) {
        const button = new discord.ButtonBuilder()
          .setCustomId(btn.customId)
          .setLabel(btn.label)
          .setStyle(styleMap[btn.style] || discord.ButtonStyle.Primary);

        if (btn.emoji) {
          button.setEmoji(btn.emoji);
        }

        row.addComponents(button);
      }
      messagePayload.components = [row];
    }

    await user.send(messagePayload);
    console.log(`✅ [Discord Bot] DM enviado a ${user.tag}`);

    return { success: true };
  } catch (error: any) {
    console.error(`❌ [Discord Bot] Error enviando DM a ${discordUserId}:`, error);

    // Error común: usuario tiene DMs desactivados
    if (error.code === 50007) {
      return { success: false, error: 'El usuario tiene los DMs desactivados' };
    }

    return { success: false, error: error.message || 'Error al enviar DM' };
  }
}

/**
 * Envía DMs a múltiples usuarios
 */
export async function sendBulkDM(
  discordUserIds: string[],
  options: DMMessageOptions
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const results = {
    sent: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const userId of discordUserIds) {
    const result = await sendDM(userId, options);
    if (result.success) {
      results.sent++;
    } else {
      results.failed++;
      results.errors.push(`${userId}: ${result.error}`);
    }

    // Rate limiting: esperar entre mensajes
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

// ============================================
// FUNCIONES DE GESTIÓN DE CANALES
// ============================================

export interface CreateCategoryOptions {
  guildId: string;
  name: string;
  permissions?: {
    roleId?: string;
    allow?: bigint[];
    deny?: bigint[];
  }[];
}

export interface CreateChannelOptions {
  guildId: string;
  name: string;
  categoryId?: string;
  topic?: string;
  type?: 'text' | 'voice';
  permissions?: {
    roleId?: string;
    allow?: bigint[];
    deny?: bigint[];
  }[];
}

/**
 * Obtiene un servidor (guild) por su ID
 */
export async function getGuild(guildId: string): Promise<DiscordGuild | null> {
  if (!isBotReady() || !discordClient) {
    return null;
  }

  try {
    return await discordClient.guilds.fetch(guildId);
  } catch (error) {
    console.error(`❌ [Discord Bot] Error obteniendo guild ${guildId}:`, error);
    return null;
  }
}

/**
 * Lista todos los servidores donde está el bot
 */
export function listGuilds(): Array<{ id: string; name: string; memberCount: number }> {
  if (!isBotReady() || !discordClient) {
    return [];
  }

  return discordClient.guilds.cache.map((guild: any) => ({
    id: guild.id,
    name: guild.name,
    memberCount: guild.memberCount,
  }));
}

/**
 * Crea una categoría en un servidor
 * Por defecto crea categorías PRIVADAS (solo el bot puede ver)
 */
export async function createCategory(
  options: CreateCategoryOptions & { isPrivate?: boolean }
): Promise<{ success: boolean; categoryId?: string; error?: string }> {
  if (!isBotReady() || !discordClient) {
    return { success: false, error: 'Bot no está conectado' };
  }

  try {
    const discord = await loadDiscordModule();
    const guild = await discordClient.guilds.fetch(options.guildId);

    if (!guild) {
      return { success: false, error: 'Servidor no encontrado' };
    }

    // Por defecto las categorías son privadas
    const isPrivate = options.isPrivate !== false;

    const permissionOverwrites: any[] = [];

    // Si es privada, denegar ViewChannel a @everyone
    if (isPrivate) {
      permissionOverwrites.push({
        id: guild.id, // @everyone
        deny: [discord.PermissionFlagsBits.ViewChannel],
      });

      // Permitir que el bot vea la categoría
      permissionOverwrites.push({
        id: discordClient.user.id,
        allow: [
          discord.PermissionFlagsBits.ViewChannel,
          discord.PermissionFlagsBits.SendMessages,
          discord.PermissionFlagsBits.ManageChannels,
        ],
      });
    }

    // Agregar permisos adicionales si se especifican
    if (options.permissions) {
      permissionOverwrites.push(...options.permissions.map((p: any) => ({
        id: p.roleId || guild.id,
        allow: p.allow || [],
        deny: p.deny || [],
      })));
    }

    const category = await guild.channels.create({
      name: options.name,
      type: discord.ChannelType.GuildCategory,
      permissionOverwrites,
    });

    console.log(`✅ [Discord Bot] Categoría creada: ${category.name} (privada: ${isPrivate})`);
    return { success: true, categoryId: category.id };
  } catch (error: any) {
    console.error('❌ [Discord Bot] Error creando categoría:', error);
    return { success: false, error: error.message || 'Error al crear categoría' };
  }
}

/**
 * Hace privada una categoría existente (y todos sus canales)
 * Deniega ViewChannel a @everyone pero PRESERVA los permisos de usuarios individuales
 */
export async function makeCategoryPrivate(
  guildId: string,
  categoryId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isBotReady() || !discordClient) {
    return { success: false, error: 'Bot no está conectado' };
  }

  try {
    const discord = await loadDiscordModule();
    const guild = await discordClient.guilds.fetch(guildId);

    if (!guild) {
      return { success: false, error: 'Servidor no encontrado' };
    }

    const category = await guild.channels.fetch(categoryId);

    if (!category) {
      return { success: false, error: 'Categoría no encontrada' };
    }

    // Obtener permisos existentes de usuarios (no roles)
    const existingOverwrites = category.permissionOverwrites.cache;
    const userOverwrites: any[] = [];

    for (const [id, overwrite] of existingOverwrites) {
      // Guardar solo permisos de usuarios (no @everyone ni roles)
      if (overwrite.type === 1) { // 1 = member/user
        userOverwrites.push({
          id,
          allow: overwrite.allow.toArray(),
          deny: overwrite.deny.toArray(),
          type: 1,
        });
      }
    }

    // Crear array de nuevos permisos
    const newOverwrites = [
      {
        id: guild.id, // @everyone
        deny: [discord.PermissionFlagsBits.ViewChannel],
      },
      {
        id: discordClient.user.id, // Bot
        allow: [
          discord.PermissionFlagsBits.ViewChannel,
          discord.PermissionFlagsBits.SendMessages,
          discord.PermissionFlagsBits.ManageChannels,
        ],
      },
      // Restaurar permisos de usuarios existentes
      ...userOverwrites,
    ];

    // Aplicar permisos
    await category.permissionOverwrites.set(newOverwrites);

    // Sincronizar canales hijos (pero NO lockPermissions porque borraría los permisos de usuario)
    // En lugar de eso, aplicar el mismo patrón a cada canal hijo
    const children = category.children?.cache || [];
    for (const [, channel] of children) {
      // Obtener permisos de usuario existentes en el canal
      const channelUserOverwrites: any[] = [];
      for (const [id, overwrite] of channel.permissionOverwrites.cache) {
        if (overwrite.type === 1) { // member/user
          channelUserOverwrites.push({
            id,
            allow: overwrite.allow.toArray(),
            deny: overwrite.deny.toArray(),
            type: 1,
          });
        }
      }

      // Aplicar permisos privados preservando usuarios
      await channel.permissionOverwrites.set([
        {
          id: guild.id,
          deny: [discord.PermissionFlagsBits.ViewChannel],
        },
        {
          id: discordClient.user.id,
          allow: [
            discord.PermissionFlagsBits.ViewChannel,
            discord.PermissionFlagsBits.SendMessages,
            discord.PermissionFlagsBits.ManageChannels,
          ],
        },
        ...channelUserOverwrites,
      ]);
    }

    console.log(`✅ [Discord Bot] Categoría "${category.name}" ahora es privada (preservando ${userOverwrites.length} usuarios, ${children.size} canales)`);
    return { success: true };
  } catch (error: any) {
    console.error('❌ [Discord Bot] Error haciendo categoría privada:', error);
    return { success: false, error: error.message || 'Error al hacer categoría privada' };
  }
}

/**
 * Crea un canal de texto en un servidor
 * Por defecto hereda permisos de la categoría padre (si es privada, el canal también)
 */
export async function createTextChannel(
  options: CreateChannelOptions & { isPrivate?: boolean }
): Promise<{ success: boolean; channelId?: string; error?: string }> {
  if (!isBotReady() || !discordClient) {
    return { success: false, error: 'Bot no está conectado' };
  }

  try {
    const discord = await loadDiscordModule();
    const guild = await discordClient.guilds.fetch(options.guildId);

    if (!guild) {
      return { success: false, error: 'Servidor no encontrado' };
    }

    const permissionOverwrites: any[] = [];

    // Si es privado explícitamente, denegar ViewChannel a @everyone
    if (options.isPrivate) {
      permissionOverwrites.push({
        id: guild.id, // @everyone
        deny: [discord.PermissionFlagsBits.ViewChannel],
      });

      // Permitir que el bot vea el canal
      permissionOverwrites.push({
        id: discordClient.user.id,
        allow: [
          discord.PermissionFlagsBits.ViewChannel,
          discord.PermissionFlagsBits.SendMessages,
          discord.PermissionFlagsBits.ManageChannels,
        ],
      });
    }

    // Agregar permisos adicionales si se especifican
    if (options.permissions) {
      permissionOverwrites.push(...options.permissions.map((p: any) => ({
        id: p.roleId || guild.id,
        allow: p.allow || [],
        deny: p.deny || [],
      })));
    }

    const channelOptions: any = {
      name: options.name,
      type: discord.ChannelType.GuildText,
      topic: options.topic,
      permissionOverwrites: permissionOverwrites.length > 0 ? permissionOverwrites : undefined,
    };

    // Asignar a categoría si se especifica
    if (options.categoryId) {
      channelOptions.parent = options.categoryId;
    }

    const channel = await guild.channels.create(channelOptions);

    console.log(`✅ [Discord Bot] Canal creado: ${channel.name}`);
    return { success: true, channelId: channel.id };
  } catch (error: any) {
    console.error('❌ [Discord Bot] Error creando canal:', error);
    return { success: false, error: error.message || 'Error al crear canal' };
  }
}

/**
 * Envía un mensaje a un canal específico
 */
export async function sendToChannel(
  channelId: string,
  options: DMMessageOptions
): Promise<{ success: boolean; error?: string }> {
  if (!isBotReady() || !discordClient) {
    return { success: false, error: 'Bot no está conectado' };
  }

  try {
    const discord = await loadDiscordModule();
    const channel = await discordClient.channels.fetch(channelId);

    if (!channel || !channel.isTextBased()) {
      return { success: false, error: 'Canal no encontrado o no es de texto' };
    }

    const messagePayload: any = {};

    if (options.content) {
      messagePayload.content = options.content;
    }

    if (options.embed) {
      const embed = new discord.EmbedBuilder();

      if (options.embed.title) embed.setTitle(options.embed.title);
      if (options.embed.description) embed.setDescription(options.embed.description);
      if (options.embed.color) embed.setColor(options.embed.color);
      if (options.embed.fields) {
        options.embed.fields.forEach((field: any) => {
          embed.addFields({ name: field.name, value: field.value, inline: field.inline });
        });
      }
      if (options.embed.footer) embed.setFooter({ text: options.embed.footer });
      if (options.embed.timestamp) embed.setTimestamp();

      messagePayload.embeds = [embed];
    }

    await channel.send(messagePayload);
    console.log(`✅ [Discord Bot] Mensaje enviado a canal ${channelId}`);

    return { success: true };
  } catch (error: any) {
    console.error(`❌ [Discord Bot] Error enviando a canal ${channelId}:`, error);
    return { success: false, error: error.message || 'Error al enviar mensaje' };
  }
}

/**
 * Elimina un canal
 */
export async function deleteChannel(
  channelId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isBotReady() || !discordClient) {
    return { success: false, error: 'Bot no está conectado' };
  }

  try {
    const channel = await discordClient.channels.fetch(channelId);

    if (!channel) {
      return { success: false, error: 'Canal no encontrado' };
    }

    await channel.delete();
    console.log(`✅ [Discord Bot] Canal eliminado: ${channelId}`);

    return { success: true };
  } catch (error: any) {
    console.error(`❌ [Discord Bot] Error eliminando canal ${channelId}:`, error);
    return { success: false, error: error.message || 'Error al eliminar canal' };
  }
}

// ============================================
// FUNCIONES DE ESTRUCTURA POR SECTOR
// ============================================

export interface SectorChannelsConfig {
  guildId: string;
  sectorName: string;
  createChannels: {
    fallas?: boolean;
    preventivos?: boolean;
    ordenesTrabajo?: boolean;
    resumenDia?: boolean;
    general?: boolean;
  };
}

export interface SectorChannelsResult {
  success: boolean;
  categoryId?: string;
  channels?: {
    fallas?: string;
    preventivos?: string;
    ordenesTrabajo?: string;
    resumenDia?: string;
    general?: string;
  };
  error?: string;
}

/**
 * Crea la estructura de canales para un sector
 * Crea una categoría con el nombre del sector y los canales necesarios
 */
export async function createSectorChannels(
  config: SectorChannelsConfig
): Promise<SectorChannelsResult> {
  if (!isBotReady() || !discordClient) {
    return { success: false, error: 'Bot no está conectado' };
  }

  try {
    // 1. Crear la categoría del sector
    const categoryResult = await createCategory({
      guildId: config.guildId,
      name: `📁 ${config.sectorName}`,
    });

    if (!categoryResult.success || !categoryResult.categoryId) {
      return { success: false, error: categoryResult.error };
    }

    const channels: SectorChannelsResult['channels'] = {};

    // 2. Crear los canales dentro de la categoría
    if (config.createChannels.fallas) {
      const result = await createTextChannel({
        guildId: config.guildId,
        name: '🔴-fallas',
        categoryId: categoryResult.categoryId,
        topic: `Alertas de fallas del sector ${config.sectorName}`,
      });
      if (result.success) channels.fallas = result.channelId;
    }

    if (config.createChannels.preventivos) {
      const result = await createTextChannel({
        guildId: config.guildId,
        name: '🔧-preventivos',
        categoryId: categoryResult.categoryId,
        topic: `Mantenimientos preventivos del sector ${config.sectorName}`,
      });
      if (result.success) channels.preventivos = result.channelId;
    }

    if (config.createChannels.ordenesTrabajo) {
      const result = await createTextChannel({
        guildId: config.guildId,
        name: '📋-ordenes-trabajo',
        categoryId: categoryResult.categoryId,
        topic: `Órdenes de trabajo del sector ${config.sectorName}`,
      });
      if (result.success) channels.ordenesTrabajo = result.channelId;
    }

    if (config.createChannels.resumenDia) {
      const result = await createTextChannel({
        guildId: config.guildId,
        name: '📊-resumen-dia',
        categoryId: categoryResult.categoryId,
        topic: `Resumen diario del sector ${config.sectorName}`,
      });
      if (result.success) channels.resumenDia = result.channelId;
    }

    if (config.createChannels.general) {
      const result = await createTextChannel({
        guildId: config.guildId,
        name: '💬-general',
        categoryId: categoryResult.categoryId,
        topic: `Chat general del sector ${config.sectorName}`,
      });
      if (result.success) channels.general = result.channelId;
    }

    console.log(`✅ [Discord Bot] Estructura de sector creada: ${config.sectorName}`);

    return {
      success: true,
      categoryId: categoryResult.categoryId,
      channels,
    };
  } catch (error: any) {
    console.error('❌ [Discord Bot] Error creando estructura de sector:', error);
    return { success: false, error: error.message || 'Error al crear estructura de sector' };
  }
}

/**
 * Obtiene la lista de miembros de un servidor
 */
export async function getGuildMembers(
  guildId: string
): Promise<Array<{ id: string; username: string; displayName: string }>> {
  if (!isBotReady() || !discordClient) {
    return [];
  }

  try {
    const guild = await discordClient.guilds.fetch(guildId);
    const members = await guild.members.fetch();

    return members
      .filter((member: any) => !member.user.bot)
      .map((member: any) => ({
        id: member.user.id,
        username: member.user.username,
        displayName: member.displayName,
      }));
  } catch (error) {
    console.error(`❌ [Discord Bot] Error obteniendo miembros de ${guildId}:`, error);
    return [];
  }
}
