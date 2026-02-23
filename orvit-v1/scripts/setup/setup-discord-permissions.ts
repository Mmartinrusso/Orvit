/**
 * Script para configurar permisos de Discord
 *
 * NOTA: Este script ahora usa el bot service HTTP API (Railway).
 * Asegurar que BOT_SERVICE_URL y BOT_API_KEY están en .env
 *
 * 1. Hace todas las categorías de sector privadas (solo bot y admins pueden ver)
 * 2. Da acceso a usuarios que ya tienen Discord vinculado
 */

import { prisma } from './lib/prisma';
import {
  manageBotChannels,
  getBotServiceStatus,
  syncBotPermissions,
} from './lib/discord/bot-service-client';

async function setup() {
  console.log('=== Configurando Permisos de Discord ===\n');

  // 1. Verificar bot service
  console.log('1. Verificando bot service...');
  const botStatus = await getBotServiceStatus();

  if (!botStatus.success || !botStatus.connected) {
    console.error('❌ Bot service no disponible:', botStatus.error || 'Bot no conectado');
    return;
  }
  console.log(`✅ Bot conectado como ${botStatus.username}\n`);

  // 2. Verificar guilds
  console.log('2. Verificando servidores...');
  const guildsResult = await manageBotChannels('getGuilds', {});
  const guilds = guildsResult.guilds || [];

  if (guilds.length === 0) {
    console.error('❌ El bot no está en ningún servidor');
    return;
  }
  console.log(`   Encontrado${guilds.length > 1 ? 's' : ''} ${guilds.length} servidor${guilds.length > 1 ? 'es' : ''}: ${guilds.map((g: any) => g.name).join(', ')}\n`);

  const guildId = guilds[0].id;

  // 3. Obtener sectores con categorías de Discord
  console.log('3. Obteniendo sectores...');
  const sectors = await prisma.sector.findMany({
    where: {
      discordCategoryId: { not: null },
    },
    select: {
      id: true,
      name: true,
      discordCategoryId: true,
    },
  });

  console.log(`   Encontrados ${sectors.length} sectores con categoría Discord\n`);

  // 4. Hacer cada categoría privada
  console.log('4. Configurando categorías como privadas...\n');

  let successCount = 0;
  for (const sector of sectors) {
    console.log(`   Procesando: ${sector.name}`);

    try {
      const result = await manageBotChannels('makeCategoryPrivate', {
        guildId,
        categoryId: sector.discordCategoryId,
      });

      if (result.success) {
        console.log('     ✅ Categoría configurada como privada');
        successCount++;
      } else {
        console.log(`     ❌ Error: ${result.error}`);
      }
    } catch (error: any) {
      console.log(`     ❌ Error: ${error.message}`);
    }
  }

  // 5. Obtener usuarios con Discord vinculado y darles acceso
  console.log('\n5. Configurando acceso de usuarios...');

  const usersWithDiscord = await prisma.user.findMany({
    where: {
      discordUserId: { not: null },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      discordUserId: true,
    },
  });

  console.log(`   Encontrados ${usersWithDiscord.length} usuarios con Discord vinculado\n`);

  for (const user of usersWithDiscord) {
    console.log(`   Configurando: ${user.name}`);

    // Crear accesos en la base de datos
    for (const sector of sectors) {
      try {
        await prisma.userDiscordAccess.upsert({
          where: {
            userId_sectorId: {
              userId: user.id,
              sectorId: sector.id,
            },
          },
          update: {},
          create: {
            userId: user.id,
            sectorId: sector.id,
          },
        });
      } catch {
        // Ignorar errores de duplicados
      }
    }

    // Dar acceso vía bot service
    if (successCount > 0) {
      for (const sector of sectors) {
        try {
          await syncBotPermissions(user.id, sector.id, 'grant');
        } catch {
          // Silenciar errores
        }
      }
    }

    console.log('     ✅ Acceso configurado');
  }

  console.log('\n=== Configuración completada ===');

  if (successCount === 0) {
    console.log('\n⚠️ IMPORTANTE: El bot no tiene permisos para gestionar canales.');
    console.log('Para arreglarlo:');
    console.log('1. Ve a Discord → Configuración del Servidor → Roles');
    console.log('2. Busca el rol del bot "Orvit"');
    console.log('3. Activa los permisos: Administrador (recomendado)');
    console.log('4. Vuelve a ejecutar este script');
  } else {
    console.log('\nAhora solo los usuarios con acceso explícito pueden ver los canales.');
    console.log('Usa /administracion/discord para gestionar accesos.');
  }
}

setup()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error fatal:', e);
    process.exit(1);
  });
