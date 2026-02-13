/**
 * Seed CorrectiveSettings para todas las empresas existentes
 *
 * Este script crea CorrectiveSettings con valores por defecto para todas
 * las empresas que aún no tienen configuración.
 *
 * Ejecutar: npx ts-node prisma/seed-corrective-settings.ts
 * O agregar a package.json scripts: "seed:corrective": "ts-node prisma/seed-corrective-settings.ts"
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Valores por defecto según plan
 */
const DEFAULT_SETTINGS = {
  // Ventanas configurables
  duplicateWindowHours: 48,       // 2 días para detectar duplicados
  recurrenceWindowDays: 7,        // 7 días para detectar reincidencia rápida
  downtimeQaThresholdMin: 60,    // 1 hora de downtime mínimo para exigir QA

  // SLA por prioridad (en horas) - Alineado con P1-P4
  slaP1Hours: 4,                  // Urgente: 4 horas
  slaP2Hours: 8,                  // Alta: 8 horas
  slaP3Hours: 24,                 // Media: 24 horas
  slaP4Hours: 72,                 // Baja: 72 horas

  // Reglas de evidencia
  requireEvidenceP3: true,        // P3 requiere al menos 1 evidencia
  requireEvidenceP2: true,        // P2 requiere evidencia + checklist
  requireEvidenceP1: true,        // P1 requiere evidencia completa

  // Retorno a producción
  requireReturnConfirmationOnDowntime: true,  // Si hubo downtime, exigir confirmación
  requireReturnConfirmationOnQA: true,        // Si QA está activo, exigir confirmación
};

async function seedCorrectiveSettings() {
  console.log('🌱 Iniciando seed de CorrectiveSettings...\n');

  try {
    // 1. Obtener todas las empresas
    const companies = await prisma.company.findMany({
      select: { id: true, name: true }
    });

    if (companies.length === 0) {
      console.log('⚠️  No se encontraron empresas. Abortando seed.');
      return;
    }

    console.log(`📊 Empresas encontradas: ${companies.length}\n`);

    let created = 0;
    let skipped = 0;

    // 2. Para cada empresa, crear CorrectiveSettings si no existe
    for (const company of companies) {
      // Verificar si ya existe
      const existing = await prisma.correctiveSettings.findUnique({
        where: { companyId: company.id }
      });

      if (existing) {
        console.log(`⏭️  [${company.name}] Ya tiene CorrectiveSettings (ID: ${existing.id})`);
        skipped++;
        continue;
      }

      // Crear CorrectiveSettings con valores por defecto
      const settings = await prisma.correctiveSettings.create({
        data: {
          companyId: company.id,
          ...DEFAULT_SETTINGS
        }
      });

      console.log(`✅ [${company.name}] CorrectiveSettings creado (ID: ${settings.id})`);
      created++;
    }

    console.log('\n' + '='.repeat(60));
    console.log(`🎉 Seed completado!`);
    console.log(`   - Creados: ${created}`);
    console.log(`   - Omitidos (ya existían): ${skipped}`);
    console.log(`   - Total empresas: ${companies.length}`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error durante el seed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar seed
seedCorrectiveSettings()
  .then(() => {
    console.log('✨ Proceso finalizado con éxito');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Proceso finalizado con errores:', error);
    process.exit(1);
  });
