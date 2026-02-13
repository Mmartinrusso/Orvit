/**
 * Node.js-only instrumentation - Discord bot auto-connect
 * This file is imported dynamically only in Node.js runtime
 */

export async function autoConnectDiscordBot() {
  // Delay para dar tiempo a que se inicialice todo
  setTimeout(async () => {
    try {
      const { prisma } = await import('./lib/prisma');
      const { connectBot, isBotReady } = await import('./lib/discord/bot');

      // Verificar si ya está conectado
      if (isBotReady()) {
        console.log('✅ [Discord Bot] Ya conectado');
        return;
      }

      // Buscar empresa con token de bot
      const company = await prisma.company.findFirst({
        where: { discordBotToken: { not: null } },
        select: { discordBotToken: true, name: true }
      });

      if (!company?.discordBotToken) {
        console.log('⚠️ [Discord Bot] No hay token de bot configurado - el bot no se conectará automáticamente');
        return;
      }

      console.log(`🔄 [Discord Bot] Auto-conectando para ${company.name}...`);
      const result = await connectBot(company.discordBotToken);

      if (result.success) {
        console.log('✅ [Discord Bot] Auto-conectado exitosamente');
      } else {
        console.warn('⚠️ [Discord Bot] No se pudo auto-conectar:', result.error);
      }
    } catch (error) {
      console.error('❌ [Discord Bot] Error en auto-connect:', error);
    }
  }, 3000);
}
