import { PrismaClient } from '@prisma/client';
import { PERMISSION_CATALOG } from '../../lib/permissions-catalog';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Sincronizando catálogo de permisos con la base de datos...\n');

  const entries = Object.entries(PERMISSION_CATALOG);
  console.log(`📋 Total de permisos en catálogo: ${entries.length}\n`);

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let errors = 0;

  for (const [name, meta] of entries) {
    try {
      const existing = await prisma.permission.findUnique({ where: { name } });

      if (!existing) {
        // Crear nuevo permiso
        await prisma.permission.create({
          data: {
            name,
            description: meta.es,
            category: meta.category,
            isActive: true,
          },
        });
        created++;
        console.log(`  ✅ Creado: ${name}`);
      } else {
        // Verificar si necesita actualización
        const needsUpdate =
          existing.description !== meta.es ||
          existing.category !== meta.category;

        if (needsUpdate) {
          await prisma.permission.update({
            where: { name },
            data: {
              description: meta.es,
              category: meta.category,
            },
          });
          updated++;
          console.log(`  🔄 Actualizado: ${name}`);
        } else {
          unchanged++;
        }
      }
    } catch (error: any) {
      errors++;
      console.error(`  ❌ Error en ${name}: ${error.message}`);
    }
  }

  console.log('\n📊 Resumen:');
  console.log(`  ✅ Creados: ${created}`);
  console.log(`  🔄 Actualizados: ${updated}`);
  console.log(`  ⏭️  Sin cambios: ${unchanged}`);
  if (errors > 0) console.log(`  ❌ Errores: ${errors}`);
  console.log(`\n  Total procesados: ${created + updated + unchanged + errors} de ${entries.length}`);
}

main()
  .catch((e) => {
    console.error('Error fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
