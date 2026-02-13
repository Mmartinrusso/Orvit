/**
 * Script para configurar permisos de Discord
 *
 * 1. Hace todas las categorías de sector privadas (solo bot y admins pueden ver)
 * 2. Da acceso a usuarios que ya tienen Discord vinculado
 */

import { prisma } from './lib/prisma';
import { getDiscordClient, connectBot, isBotReady } from './lib/discord/bot';

async function setup() {
  console.log('=== Configurando Permisos de Discord ===\n');

  // 1. Conectar bot
  console.log('1. Conectando bot...');
  const company = await prisma.company.findFirst({
    where: { discordBotToken: { not: null } },
    select: { discordBotToken: true, id: true }
  });

  if (!company?.discordBotToken) {
    console.error('❌ No hay token de bot configurado');
    return;
  }

  await connectBot(company.discordBotToken);

  if (!isBotReady()) {
    console.error('❌ Bot no pudo conectarse');
    return;
  }

  const client = await getDiscordClient();
  const discord = await import('discord.js');
  console.log('✅ Bot conectado\n');

  // Verificar permisos del bot
  console.log('2. Verificando permisos del bot...');
  const guilds = client.guilds.cache;
  for (const [, guild] of guilds) {
    const botMember = guild.members.cache.get(client.user.id);
    if (botMember) {
      const perms = botMember.permissions;
      console.log('   Guild: ' + guild.name);
      console.log('   - Administrator: ' + perms.has(discord.PermissionFlagsBits.Administrator));
      console.log('   - ManageChannels: ' + perms.has(discord.PermissionFlagsBits.ManageChannels));
      console.log('   - ManageRoles: ' + perms.has(discord.PermissionFlagsBits.ManageRoles));
    }
  }

  // 3. Obtener sectores con categorías de Discord
  console.log('\n3. Obteniendo sectores...');
  const sectors = await prisma.sector.findMany({
    where: {
      discordCategoryId: { not: null }
    },
    select: {
      id: true,
      name: true,
      discordCategoryId: true,
    }
  });

  console.log('   Encontrados ' + sectors.length + ' sectores con categoría Discord\n');

  // 4. Intentar hacer cada categoría privada
  console.log('4. Configurando categorías como privadas...\n');

  let successCount = 0;
  for (const sector of sectors) {
    console.log('   Procesando: ' + sector.name);

    try {
      const category = await client.channels.fetch(sector.discordCategoryId);

      if (!category) {
        console.log('     ❌ Categoría no encontrada');
        continue;
      }

      const guild = category.guild;

      // Hacer la categoría privada para @everyone
      await category.permissionOverwrites.edit(guild.id, {
        ViewChannel: false,
      });

      // Obtener canales de la categoría
      const channels = guild.channels.cache.filter(
        (ch: any) => ch.parentId === sector.discordCategoryId
      );

      // Hacer todos los canales privados
      for (const [, channel] of channels) {
        await (channel as any).permissionOverwrites.edit(guild.id, {
          ViewChannel: false,
        });
      }

      console.log('     ✅ Categoría y ' + channels.size + ' canales configurados como privados');
      successCount++;

      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error: any) {
      console.log('     ❌ Error: ' + error.message);
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
      email: true,
    }
  });

  console.log('   Encontrados ' + usersWithDiscord.length + ' usuarios con Discord vinculado\n');

  // Para cada usuario, crear acceso a TODOS los sectores (inicialmente todos tienen acceso)
  for (const user of usersWithDiscord) {
    console.log('   Configurando: ' + user.name);

    // Crear accesos en la base de datos
    for (const sector of sectors) {
      try {
        await prisma.userDiscordAccess.upsert({
          where: {
            userId_sectorId: {
              userId: user.id,
              sectorId: sector.id
            }
          },
          update: {},
          create: {
            userId: user.id,
            sectorId: sector.id,
          }
        });
      } catch (e) {
        // Ignorar errores de duplicados
      }
    }

    // Dar acceso en Discord a todas las categorías
    if (successCount > 0) {
      for (const sector of sectors) {
        try {
          const category = await client.channels.fetch(sector.discordCategoryId);
          if (!category) continue;

          const guild = category.guild;
          const channels = guild.channels.cache.filter(
            (ch: any) => ch.parentId === sector.discordCategoryId
          );

          // Dar acceso a la categoría
          await category.permissionOverwrites.create(user.discordUserId!, {
            ViewChannel: true,
            ReadMessageHistory: true,
          });

          // Dar acceso a cada canal
          for (const [, channel] of channels) {
            await (channel as any).permissionOverwrites.create(user.discordUserId!, {
              ViewChannel: true,
              ReadMessageHistory: true,
              SendMessages: true,
            });
          }
        } catch (error: any) {
          // Silenciar errores por ahora
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('     ✅ Acceso configurado en DB');
  }

  console.log('\n=== Configuración completada ===');

  if (successCount === 0) {
    console.log('\n⚠️ IMPORTANTE: El bot no tiene permisos para gestionar canales.');
    console.log('Para arreglarlo:');
    console.log('1. Ve a Discord → Configuración del Servidor → Roles');
    console.log('2. Busca el rol del bot "Orvit"');
    console.log('3. Activa los permisos:');
    console.log('   - Administrador (recomendado)');
    console.log('   - O al menos: Gestionar Canales + Gestionar Roles');
    console.log('4. Vuelve a ejecutar este script');
  } else {
    console.log('\nAhora solo los usuarios con acceso explícito pueden ver los canales.');
    console.log('Usa /administracion/discord para gestionar accesos.');
  }
}

setup()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error fatal:', e);
    process.exit(1);
  });
