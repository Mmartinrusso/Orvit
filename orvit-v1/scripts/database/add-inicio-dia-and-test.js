/**
 * Script para:
 * 1. Agregar canal "inicio-dia" a cada sector
 * 2. Enviar mensaje de prueba a cada canal
 */

const { Client, GatewayIntentBits, ChannelType, EmbedBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!TOKEN || !GUILD_ID) {
  console.error('Error: Set DISCORD_BOT_TOKEN and DISCORD_GUILD_ID environment variables');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

// Colores
const COLORS = {
  RED: 0xED4245,
  GREEN: 0x57F287,
  BLUE: 0x5865F2,
  ORANGE: 0xE67E22,
  PURPLE: 0x9B59B6,
  CYAN: 0x3498DB,
};

async function sendTestMessages(guild, sector) {
  console.log(`\n📨 Enviando mensajes de prueba para: ${sector.name}`);

  const channelIds = {
    fallas: sector.discordFallasChannelId,
    preventivos: sector.discordPreventivosChannelId,
    ordenesTrabajo: sector.discordOTChannelId,
    resumenDia: sector.discordResumenChannelId,
    inicioDia: sector.discordInicioDiaChannelId,
  };

  // 1. Mensaje en canal de FALLAS
  if (channelIds.fallas) {
    try {
      const channel = await guild.channels.fetch(channelIds.fallas);
      const embed = new EmbedBuilder()
        .setTitle('🔴 Nueva Falla Reportada')
        .setDescription('**Motor principal no arranca**\n\n⏱️ **PRODUCCIÓN PARADA**')
        .setColor(COLORS.RED)
        .addFields(
          { name: '🏭 Máquina', value: 'Torno CNC #3', inline: true },
          { name: '🚨 Prioridad', value: 'P1 - CRÍTICA', inline: true },
          { name: '📂 Categoría', value: 'Eléctrica', inline: true },
          { name: '👤 Reportado por', value: 'Lucas Russo', inline: true },
          { name: '📝 Descripción', value: 'El motor no responde al encendido. Se escucha un click pero no gira.' }
        )
        .setFooter({ text: 'Falla #1234' })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      console.log('   ✅ Mensaje enviado a #fallas');
    } catch (e) {
      console.log(`   ❌ Error en #fallas: ${e.message}`);
    }
  }

  // 2. Mensaje en canal de PREVENTIVOS
  if (channelIds.preventivos) {
    try {
      const channel = await guild.channels.fetch(channelIds.preventivos);
      const embed = new EmbedBuilder()
        .setTitle('🔧 Recordatorio de Preventivo')
        .setDescription('**Lubricación general - Torno CNC #1**')
        .setColor(COLORS.CYAN)
        .addFields(
          { name: '🏭 Máquina', value: 'Torno CNC #1', inline: true },
          { name: '🚨 Días restantes', value: '1 día', inline: true },
          { name: '📅 Fecha programada', value: '17/01/2026', inline: true },
          { name: '👤 Asignado a', value: 'Lucas Russo', inline: true }
        )
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      console.log('   ✅ Mensaje enviado a #preventivos');
    } catch (e) {
      console.log(`   ❌ Error en #preventivos: ${e.message}`);
    }
  }

  // 3. Mensaje en canal de ÓRDENES DE TRABAJO
  if (channelIds.ordenesTrabajo) {
    try {
      const channel = await guild.channels.fetch(channelIds.ordenesTrabajo);
      const embed = new EmbedBuilder()
        .setTitle('👤 OT Asignada')
        .setDescription('**Reparación de motor principal**')
        .setColor(COLORS.ORANGE)
        .addFields(
          { name: '🚨 Prioridad', value: 'P1 - CRÍTICA', inline: true },
          { name: '👤 Asignado a', value: 'Lucas Russo', inline: true },
          { name: '👤 Asignado por', value: 'Admin', inline: true },
          { name: '🏭 Máquina', value: 'Torno CNC #3', inline: true },
          { name: '📅 Programado', value: '16/01/2026', inline: true },
          { name: '⏰ SLA', value: '4 horas', inline: true }
        )
        .setFooter({ text: 'OT #4567' })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      console.log('   ✅ Mensaje enviado a #ordenes-trabajo');
    } catch (e) {
      console.log(`   ❌ Error en #ordenes-trabajo: ${e.message}`);
    }
  }

  // 4. Mensaje en canal de RESUMEN DEL DÍA
  if (channelIds.resumenDia) {
    try {
      const channel = await guild.channels.fetch(channelIds.resumenDia);
      const embed = new EmbedBuilder()
        .setTitle('📊 Resumen del Día - 16/01/2026')
        .setDescription(`**Sector: ${sector.name}**`)
        .setColor(COLORS.PURPLE)
        .addFields(
          { name: '🔴 Fallas', value: '📥 Nuevas: 3\n✅ Resueltas: 4\n⏳ Pendientes: 2', inline: true },
          { name: '📋 Órdenes de Trabajo', value: '✅ Completadas: 5\n⏳ En progreso: 1\n⏸️ En espera: 1', inline: true },
          { name: '🔧 Preventivos', value: '✅ Completados: 3/3\n📊 Cumplimiento: 100%', inline: true },
          { name: '⏱️ Downtime Total', value: '3h 20min', inline: true },
          { name: '👤 Técnico destacado', value: 'Lucas Russo (5 OTs completadas)', inline: true }
        )
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      console.log('   ✅ Mensaje enviado a #resumen-dia');
    } catch (e) {
      console.log(`   ❌ Error en #resumen-dia: ${e.message}`);
    }
  }

  // 5. Mensaje en canal de INICIO DEL DÍA
  if (channelIds.inicioDia) {
    try {
      const channel = await guild.channels.fetch(channelIds.inicioDia);
      const embed = new EmbedBuilder()
        .setTitle('☀️ Inicio del Día - 16/01/2026')
        .setDescription(`**Buenos días equipo de ${sector.name}!**\n\nResumen de lo que nos espera hoy:`)
        .setColor(COLORS.BLUE)
        .addFields(
          { name: '🏭 Estado del Sector', value: '✅ 8/10 máquinas operativas\n⚠️ 2 máquinas en mantenimiento', inline: false },
          { name: '🔴 Fallas Pendientes', value: '• Torno CNC #3 - Motor no arranca (P1)\n• Fresadora #2 - Vibración excesiva (P2)', inline: false },
          { name: '📋 OTs para Hoy', value: '• OT #4567 - Reparación motor (Lucas Russo)\n• OT #4568 - Revisión hidráulica (Carlos M.)\n• OT #4569 - Cambio de rodamientos (Pedro G.)', inline: false },
          { name: '🔧 Preventivos Programados', value: '1. 08:00 - Lubricación Torno CNC #1 (Lucas Russo)\n2. 10:00 - Revisión correas Fresadora #2 (Carlos M.)\n3. 14:00 - Cambio filtros Compresor (Pedro G.)', inline: false },
          { name: '👥 Equipo del Día', value: '• Lucas Russo\n• Carlos Méndez\n• Pedro García', inline: true },
          { name: '📞 Guardia', value: 'Lucas Russo\nTel: +54 351 XXX-XXXX', inline: true }
        )
        .setFooter({ text: '¡Que tengan un excelente día de trabajo!' })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      console.log('   ✅ Mensaje enviado a #inicio-dia');
    } catch (e) {
      console.log(`   ❌ Error en #inicio-dia: ${e.message}`);
    }
  }
}

async function main() {
  console.log('🔄 Conectando bot de Discord...');

  client.once('ready', async () => {
    console.log(`✅ Bot conectado: ${client.user.tag}`);

    try {
      const guild = await client.guilds.fetch(GUILD_ID);
      console.log(`🏠 Servidor: ${guild.name}`);

      // Obtener todos los sectores con canales
      const sectors = await prisma.sector.findMany({
        where: {
          discordCategoryId: { not: null }
        },
        orderBy: { name: 'asc' },
      });

      console.log(`\n📋 Procesando ${sectors.length} sectores\n`);

      for (const sector of sectors) {
        // 1. Crear canal de inicio-dia si no existe
        if (!sector.discordInicioDiaChannelId && sector.discordCategoryId) {
          console.log(`\n📁 Agregando #inicio-dia a: ${sector.name}`);

          try {
            const inicioDiaChannel = await guild.channels.create({
              name: '☀️-inicio-dia',
              type: ChannelType.GuildText,
              parent: sector.discordCategoryId,
              topic: `Resumen matutino del sector ${sector.name}`,
            });

            // Actualizar en BD
            await prisma.sector.update({
              where: { id: sector.id },
              data: { discordInicioDiaChannelId: inicioDiaChannel.id }
            });

            sector.discordInicioDiaChannelId = inicioDiaChannel.id;
            console.log(`   ✅ Canal #inicio-dia creado`);
          } catch (e) {
            console.log(`   ❌ Error creando canal: ${e.message}`);
          }
        }

        // 2. Enviar mensajes de prueba
        await sendTestMessages(guild, sector);

        // Esperar entre sectores
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log('\n' + '='.repeat(50));
      console.log('✅ Proceso completado');
      console.log('   Mensajes de prueba enviados para Lucas Russo');

    } catch (error) {
      console.error('❌ Error:', error);
    }

    await cleanup();
  });

  client.login(TOKEN);
}

async function cleanup() {
  console.log('\n🔌 Desconectando...');
  await prisma.$disconnect();
  client.destroy();
  process.exit(0);
}

main().catch(async (error) => {
  console.error('❌ Error fatal:', error);
  await cleanup();
});
