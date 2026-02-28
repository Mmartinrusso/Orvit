/**
 * Seed de Herramientas y Repuestos — Demo para circuito de fallas
 *
 * Crea items de pañol de distintos tipos para probar el flujo completo:
 *   Falla → OT → Reserva en pañol → Ejecutar mantenimiento → Confirmar recursos
 *
 * Tipos creados:
 *   HAND_TOOL   — vuelven al pañol, pueden dañarse
 *   SPARE_PART  — se instalan, salen del stock permanentemente
 *   CONSUMABLE  — insumos de alto consumo (aceites, grasa)
 *   MATERIAL    — materiales (selladores, cintas, cables)
 *
 * Ejecutar: npx tsx prisma/seeds/seed-tools-demo.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedToolsDemo() {
  console.log('🔧 Iniciando seed de Herramientas Demo...\n');

  const company = await prisma.company.findFirst({ select: { id: true, name: true } });
  if (!company) {
    console.log('⚠️  No se encontró ninguna empresa. Abortando.');
    return;
  }
  console.log(`✅ Empresa: ${company.name} (id: ${company.id})\n`);

  const items = [
    // ─── HAND_TOOL ──────────────────────────────────────────────────────────
    {
      name: 'Llave inglesa regulable 12"',
      description: 'Llave ajustable de acero cromo-vanadio, apertura máx. 32mm',
      code: 'HT-LLI-001',
      itemType: 'HAND_TOOL',
      category: 'Llaves y torque',
      brand: 'Stanley',
      model: '87-366',
      stockQuantity: 3,
      minStockLevel: 1,
      location: 'Pañol — Cajón A1',
      cost: 4500,
      unit: 'unidad',
    },
    {
      name: 'Destornillador Phillips PH2',
      description: 'Destornillador de punta Phillips #2, mango ergonómico',
      code: 'HT-DPH-001',
      itemType: 'HAND_TOOL',
      category: 'Destornilladores',
      brand: 'Bahco',
      model: 'B219.002.150',
      stockQuantity: 5,
      minStockLevel: 2,
      location: 'Pañol — Cajón A1',
      cost: 1800,
      unit: 'unidad',
    },
    {
      name: 'Multímetro digital',
      description: 'Multímetro True RMS, medición de voltaje/corriente/resistencia',
      code: 'HT-MUL-001',
      itemType: 'HAND_TOOL',
      category: 'Instrumentos de medición',
      brand: 'Fluke',
      model: '117',
      stockQuantity: 2,
      minStockLevel: 1,
      location: 'Pañol — Estante B2',
      cost: 65000,
      unit: 'unidad',
      requiresCalibration: true,
    },
    {
      name: 'Llave de torque 1/2" (20–200 Nm)',
      description: 'Llave dinamométrica de clic con escala Nm/lb-ft',
      code: 'HT-TRQ-001',
      itemType: 'HAND_TOOL',
      category: 'Llaves y torque',
      brand: 'Gedore',
      model: 'TBN 200',
      stockQuantity: 2,
      minStockLevel: 1,
      location: 'Pañol — Estante B3',
      cost: 28000,
      unit: 'unidad',
      requiresCalibration: true,
    },

    // ─── SPARE_PART ─────────────────────────────────────────────────────────
    {
      name: 'Filtro de aceite motor',
      description: 'Filtro de aceite para motor eléctrico y reductor. Roscado 3/4"-16',
      code: 'SP-FIL-001',
      itemType: 'SPARE_PART',
      category: 'Filtros',
      brand: 'Mann Filter',
      model: 'W 712/4',
      stockQuantity: 12,
      minStockLevel: 3,
      reorderPoint: 5,
      location: 'Pañol — Rack C1',
      cost: 2200,
      unit: 'unidad',
      isCritical: true,
      leadTimeDays: 3,
    },
    {
      name: 'Rodamiento 6204-2RS',
      description: 'Rodamiento de bolas ranura profunda, sellado doble. ID=20mm OD=47mm W=14mm',
      code: 'SP-ROD-6204',
      itemType: 'SPARE_PART',
      category: 'Rodamientos',
      brand: 'SKF',
      model: '6204-2RS1',
      stockQuantity: 8,
      minStockLevel: 2,
      reorderPoint: 4,
      location: 'Pañol — Rack C2',
      cost: 3500,
      unit: 'unidad',
      isCritical: true,
      leadTimeDays: 5,
    },
    {
      name: 'Correa trapezoidal A-54',
      description: 'Correa en V perfil A, longitud exterior 54" (1372mm)',
      code: 'SP-COR-A54',
      itemType: 'SPARE_PART',
      category: 'Transmisión',
      brand: 'Gates',
      model: 'A54',
      stockQuantity: 6,
      minStockLevel: 2,
      location: 'Pañol — Rack D1',
      cost: 1800,
      unit: 'unidad',
    },
    {
      name: 'Sello de aceite 35×62×10',
      description: 'Retén de aceite NBR, dim. 35x62x10mm',
      code: 'SP-SEL-001',
      itemType: 'SPARE_PART',
      category: 'Sellos y retenes',
      brand: 'Freudenberg',
      model: 'FKM 35-62-10',
      stockQuantity: 10,
      minStockLevel: 3,
      location: 'Pañol — Cajón C5',
      cost: 950,
      unit: 'unidad',
    },

    // ─── CONSUMABLE ─────────────────────────────────────────────────────────
    {
      name: 'Aceite hidráulico ISO 46',
      description: 'Aceite mineral para sistemas hidráulicos, ISO VG 46',
      code: 'CO-AHI-001',
      itemType: 'CONSUMABLE',
      category: 'Lubricantes',
      brand: 'Shell',
      model: 'Tellus S2 M 46',
      stockQuantity: 40,
      minStockLevel: 10,
      reorderPoint: 15,
      location: 'Pañol — Depósito líquidos',
      cost: 850,
      unit: 'litro',
    },
    {
      name: 'Grasa multipropósito NLGI 2',
      description: 'Grasa de litio para rodamientos y articulaciones, consistencia NLGI 2',
      code: 'CO-GMP-001',
      itemType: 'CONSUMABLE',
      category: 'Lubricantes',
      brand: 'Mobil',
      model: 'Mobilux EP 2',
      stockQuantity: 20,
      minStockLevel: 5,
      location: 'Pañol — Depósito líquidos',
      cost: 480,
      unit: 'kg',
    },
    {
      name: 'Trapo de limpieza industrial',
      description: 'Trapo de algodón blanqueado, 1kg/paquete',
      code: 'CO-TRA-001',
      itemType: 'CONSUMABLE',
      category: 'Limpieza',
      stockQuantity: 30,
      minStockLevel: 5,
      location: 'Pañol — Estante E1',
      cost: 350,
      unit: 'kg',
    },

    // ─── MATERIAL ───────────────────────────────────────────────────────────
    {
      name: 'Silicona selladora de alta temperatura',
      description: 'Sellador de silicona rojo, resistente hasta 300°C. Pomo 85g',
      code: 'MA-SIL-001',
      itemType: 'MATERIAL',
      category: 'Selladores',
      brand: 'Loctite',
      model: '598',
      stockQuantity: 15,
      minStockLevel: 3,
      location: 'Pañol — Cajón D3',
      cost: 1200,
      unit: 'unidad',
    },
    {
      name: 'Cinta de teflón 3/4"',
      description: 'Cinta PTFE para sellado de roscas, rollo 10m × 19mm',
      code: 'MA-TEF-001',
      itemType: 'MATERIAL',
      category: 'Selladores',
      stockQuantity: 50,
      minStockLevel: 10,
      location: 'Pañol — Cajón D3',
      cost: 180,
      unit: 'rollo',
    },
  ];

  let created = 0;
  let skipped = 0;

  for (const item of items) {
    const exists = await prisma.tool.findFirst({
      where: { code: item.code, companyId: company.id },
    });

    if (exists) {
      console.log(`  ⏭  Ya existe: ${item.name} (${item.code})`);
      skipped++;
      continue;
    }

    await (prisma.tool as any).create({
      data: {
        ...item,
        companyId: company.id,
        status: 'AVAILABLE',
      },
    });

    const typeEmoji: Record<string, string> = {
      HAND_TOOL: '🔧',
      SPARE_PART: '📦',
      CONSUMABLE: '🧴',
      MATERIAL: '🪛',
    };
    console.log(`  ${typeEmoji[item.itemType] || '•'} Creado: [${item.itemType}] ${item.name}`);
    created++;
  }

  console.log(`\n✅ Seed completado — ${created} items creados, ${skipped} ya existían.\n`);
  console.log('Tipos disponibles para probar el circuito de fallas:');
  console.log('  🔧 HAND_TOOL   — Llave inglesa, Destornillador, Multímetro, Torque');
  console.log('  📦 SPARE_PART  — Filtro aceite, Rodamiento 6204, Correa A-54, Sello');
  console.log('  🧴 CONSUMABLE  — Aceite ISO 46, Grasa NLGI 2, Trapo industrial');
  console.log('  🪛 MATERIAL    — Silicona alta temp, Cinta teflón\n');
}

seedToolsDemo()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
