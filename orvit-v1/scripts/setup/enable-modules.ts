/**
 * Enable all Compras modules for the first company
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COMPRAS_MODULES = [
  { key: 'purchases_core', name: 'Compras - Core', description: 'Módulo base de compras', category: 'COMPRAS' as const },
  { key: 'purchase_orders', name: 'Órdenes de Compra', description: 'Gestión de órdenes de compra', category: 'COMPRAS' as const },
  { key: 'supplier_ledger', name: 'Cuenta Corriente Proveedores', description: 'Cuentas corrientes de proveedores', category: 'COMPRAS' as const },
  { key: 'stock_management', name: 'Gestión de Stock', description: 'Control de inventario', category: 'COMPRAS' as const },
  { key: 'cost_centers', name: 'Centros de Costo', description: 'Asignación por centro de costo', category: 'COMPRAS' as const },
  { key: 'projects', name: 'Proyectos', description: 'Asignación por proyecto', category: 'COMPRAS' as const },
];

async function enableModules() {
  console.log('📦 Habilitando módulos de Compras...\n');

  try {
    // 1. Obtener empresa
    const company = await prisma.company.findFirst({ select: { id: true, name: true } });
    if (!company) {
      console.log('❌ No hay empresa');
      return;
    }
    console.log('✅ Empresa:', company.name, '(ID:', company.id + ')');

    // 2. Crear/verificar módulos
    console.log('\n📋 Verificando módulos...');
    for (const mod of COMPRAS_MODULES) {
      const existing = await prisma.module.findUnique({ where: { key: mod.key } });
      if (!existing) {
        await prisma.module.create({
          data: {
            key: mod.key,
            name: mod.name,
            description: mod.description,
            category: mod.category,
          }
        });
        console.log(`   ✅ Módulo creado: ${mod.key}`);
      } else {
        console.log(`   ✓ Módulo existe: ${mod.key}`);
      }
    }

    // 3. Habilitar módulos para la empresa
    console.log('\n🔧 Habilitando módulos para empresa...');
    for (const mod of COMPRAS_MODULES) {
      const module = await prisma.module.findUnique({ where: { key: mod.key } });
      if (!module) continue;

      const existingLink = await prisma.companyModule.findUnique({
        where: {
          companyId_moduleId: {
            companyId: company.id,
            moduleId: module.id,
          }
        }
      });

      if (existingLink) {
        if (!existingLink.isEnabled) {
          await prisma.companyModule.update({
            where: { id: existingLink.id },
            data: { isEnabled: true }
          });
          console.log(`   ✅ Módulo habilitado: ${mod.key}`);
        } else {
          console.log(`   ✓ Ya habilitado: ${mod.key}`);
        }
      } else {
        await prisma.companyModule.create({
          data: {
            companyId: company.id,
            moduleId: module.id,
            isEnabled: true,
          }
        });
        console.log(`   ✅ Módulo vinculado y habilitado: ${mod.key}`);
      }
    }

    // 4. Mostrar resumen
    console.log('\n' + '='.repeat(50));
    console.log('📊 MÓDULOS HABILITADOS');
    console.log('='.repeat(50));

    const enabledModules = await prisma.companyModule.findMany({
      where: { companyId: company.id, isEnabled: true },
      include: { module: true }
    });

    enabledModules.forEach(cm => {
      console.log(`   ✅ ${cm.module.key}: ${cm.module.name}`);
    });

    console.log('\n✨ Listo! Ahora las APIs de Compras deberían funcionar.');
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

enableModules()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
