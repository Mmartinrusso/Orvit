/**
 * Script para crear canales de Discord para todos los sectores
 *
 * Ejecutar: node scripts/create-discord-channels.js
 */

const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
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

async function createSectorChannels(guild, sector) {
  console.log(`\n📁 Creando estructura para sector: ${sector.name}`);

  try {
    // 1. Crear la categoría
    const category = await guild.channels.create({
      name: `📁 ${sector.name}`,
      type: ChannelType.GuildCategory,
    });
    console.log(`   ✅ Categoría creada: ${category.name}`);

    // 2. Crear los canales
    const channels = {};

    // Canal de Fallas
    channels.fallas = await guild.channels.create({
      name: '🔴-fallas',
      type: ChannelType.GuildText,
      parent: category.id,
      topic: `Alertas de fallas del sector ${sector.name}`,
    });
    console.log(`   ✅ Canal creado: #${channels.fallas.name}`);

    // Canal de Preventivos
    channels.preventivos = await guild.channels.create({
      name: '🔧-preventivos',
      type: ChannelType.GuildText,
      parent: category.id,
      topic: `Mantenimientos preventivos del sector ${sector.name}`,
    });
    console.log(`   ✅ Canal creado: #${channels.preventivos.name}`);

    // Canal de Órdenes de Trabajo
    channels.ordenesTrabajo = await guild.channels.create({
      name: '📋-ordenes-trabajo',
      type: ChannelType.GuildText,
      parent: category.id,
      topic: `Órdenes de trabajo del sector ${sector.name}`,
    });
    console.log(`   ✅ Canal creado: #${channels.ordenesTrabajo.name}`);

    // Canal de Resumen del Día
    channels.resumenDia = await guild.channels.create({
      name: '📊-resumen-dia',
      type: ChannelType.GuildText,
      parent: category.id,
      topic: `Resumen diario del sector ${sector.name}`,
    });
    console.log(`   ✅ Canal creado: #${channels.resumenDia.name}`);

    // Canal General
    channels.general = await guild.channels.create({
      name: '💬-general',
      type: ChannelType.GuildText,
      parent: category.id,
      topic: `Chat general del sector ${sector.name}`,
    });
    console.log(`   ✅ Canal creado: #${channels.general.name}`);

    // 3. Actualizar el sector en la BD con los IDs de los canales
    await prisma.sector.update({
      where: { id: sector.id },
      data: {
        discordCategoryId: category.id,
        discordFallasChannelId: channels.fallas.id,
        discordPreventivosChannelId: channels.preventivos.id,
        discordOTChannelId: channels.ordenesTrabajo.id,
        discordResumenChannelId: channels.resumenDia.id,
      },
    });
    console.log(`   ✅ Base de datos actualizada`);

    return { category, channels };

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🔄 Conectando bot de Discord...');

  client.once('ready', async () => {
    console.log(`✅ Bot conectado: ${client.user.tag}`);

    try {
      // Obtener el servidor
      const guild = await client.guilds.fetch(GUILD_ID);
      console.log(`🏠 Servidor: ${guild.name}`);

      // Obtener todos los sectores
      const sectors = await prisma.sector.findMany({
        orderBy: { name: 'asc' },
      });

      console.log(`\n📋 Encontrados ${sectors.length} sectores\n`);

      if (sectors.length === 0) {
        console.log('⚠️ No hay sectores en la base de datos');
        await cleanup();
        return;
      }

      // Crear canales para cada sector
      let created = 0;
      let skipped = 0;

      for (const sector of sectors) {
        // Verificar si ya tiene canales creados
        if (sector.discordCategoryId) {
          console.log(`⏭️ Sector "${sector.name}" ya tiene canales (saltando)`);
          skipped++;
          continue;
        }

        const result = await createSectorChannels(guild, sector);
        if (result) {
          created++;
        }

        // Esperar un poco entre creaciones para no saturar la API de Discord
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log('\n' + '='.repeat(50));
      console.log(`✅ Proceso completado`);
      console.log(`   - Sectores procesados: ${sectors.length}`);
      console.log(`   - Canales creados: ${created}`);
      console.log(`   - Saltados (ya existían): ${skipped}`);

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
