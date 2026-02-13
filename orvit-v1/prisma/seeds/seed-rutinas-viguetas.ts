/**
 * Seed: Rutinas de Producción Viguetas
 *
 * Ejecutar con:
 * npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seeds/seed-rutinas-viguetas.ts
 *
 * O desde la API: POST /api/admin/seed-rutinas-viguetas
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper para generar IDs únicos
const genId = () => `q_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

// ============================================================================
// RUTINA 1: INICIO DEL DÍA
// ============================================================================
const RUTINA_INICIO_DIA = {
  code: 'VIG_INICIO_DIA',
  name: 'Inicio del Día - Viguetas',
  type: 'SHIFT_START',
  frequency: 'DAILY',
  items: [
    // Nivel de insumos
    { id: genId(), description: 'Nivel Silo 3', inputs: [{ id: genId(), type: 'RATING', label: 'Nivel Silo 3', required: true, ratingMax: 10 }] },
    { id: genId(), description: 'Nivel Silo 4', inputs: [{ id: genId(), type: 'RATING', label: 'Nivel Silo 4', required: true, ratingMax: 10 }] },
    { id: genId(), description: '¿Qué silo se utiliza hoy?', inputs: [{ id: genId(), type: 'SELECT', label: '¿Qué silo se utiliza hoy?', required: true, options: ['Silo 3', 'Silo 4', 'Ambos'] }] },
    { id: genId(), description: 'Nivel triturado 3/9', inputs: [{ id: genId(), type: 'SELECT', label: 'Nivel triturado 3/9', required: true, options: ['Suficiente', 'Bajo', 'Crítico'] }] },
    { id: genId(), description: 'Nivel arena', inputs: [{ id: genId(), type: 'SELECT', label: 'Nivel arena', required: true, options: ['Suficiente', 'Bajo', 'Crítico'] }] },
    // Personal
    { id: genId(), description: 'Personal posicionado del día', inputs: [{ id: genId(), type: 'EMPLOYEE_SELECT', label: 'Personal posicionado del día', required: true }] },
    // Limpieza
    { id: genId(), description: 'Carro de mezcla limpio', inputs: [{ id: genId(), type: 'CHECK', label: 'Carro de mezcla limpio', required: true }] },
    { id: genId(), description: 'Viguetera limpia', inputs: [{ id: genId(), type: 'CHECK', label: 'Viguetera limpia', required: true }] },
    { id: genId(), description: 'Carro aéreo limpio', inputs: [{ id: genId(), type: 'CHECK', label: 'Carro aéreo limpio', required: true }] },
    { id: genId(), description: 'Pozo mugre - estado correcto', inputs: [{ id: genId(), type: 'CHECK', label: 'Pozo mugre - estado correcto', required: true }] },
    { id: genId(), description: 'Foto pozo mugre (si hay problema)', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto pozo mugre', required: false }] },
    { id: genId(), description: 'Desagote/limpieza general OK', inputs: [{ id: genId(), type: 'CHECK', label: 'Desagote/limpieza general OK', required: true }] },
    { id: genId(), description: 'Foto desagote (si hay problema)', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto desagote', required: false }] },
    // Bancos curados
    { id: genId(), description: '¿Fisuras en bancos curados (9-10)?', inputs: [{ id: genId(), type: 'CHECK', label: '¿Fisuras en bancos curados?', required: true }] },
    { id: genId(), description: 'Si hay fisuras, ¿qué paños?', inputs: [{ id: genId(), type: 'TEXT', label: 'Paños con fisuras', required: false, placeholder: 'Ej: Paño 3, Paño 5' }] },
    { id: genId(), description: 'Estado hormigón curado', inputs: [{ id: genId(), type: 'SELECT', label: 'Estado hormigón curado', required: true, options: ['Normal', 'Seco', 'Húmedo'] }] },
    { id: genId(), description: 'Foto bancos curados', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto bancos curados', required: true }] },
    // Firma
    { id: genId(), description: 'Firma supervisor', inputs: [{ id: genId(), type: 'SIGNATURE', label: 'Firma supervisor', required: true }] },
  ],
};

// ============================================================================
// RUTINA 2: CONTROL ÁRIDOS (por carga)
// ============================================================================
const RUTINA_CONTROL_ARIDOS = {
  code: 'VIG_CTRL_ARIDOS',
  name: 'Control Áridos - Por Carga',
  type: 'QUALITY',
  frequency: 'EVERY_SHIFT',
  items: [
    { id: genId(), description: 'Foto triturado 3/9', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto triturado 3/9', required: true }] },
    { id: genId(), description: 'Estado triturado', inputs: [{ id: genId(), type: 'CHECK', label: 'Triturado en buen estado', required: true }] },
    { id: genId(), description: 'Foto arena', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto arena', required: true }] },
    { id: genId(), description: 'Estado arena', inputs: [{ id: genId(), type: 'CHECK', label: 'Arena en buen estado', required: true }] },
    { id: genId(), description: 'Observaciones', inputs: [{ id: genId(), type: 'TEXT', label: 'Observaciones', required: false, placeholder: 'Notas adicionales sobre la carga' }] },
  ],
};

// ============================================================================
// RUTINA 3: CONTROL POR BANCO
// ============================================================================
const RUTINA_CONTROL_BANCO = {
  code: 'VIG_CTRL_BANCO',
  name: 'Control por Banco',
  type: 'QUALITY',
  frequency: 'EVERY_SHIFT',
  items: [
    // Inicio banco
    { id: genId(), description: 'Banco Nº', inputs: [{ id: genId(), type: 'VALUE', label: 'Banco Nº', required: true, unit: '', minValue: 1, maxValue: 12 }] },
    { id: genId(), description: 'Estado general inicio', inputs: [{ id: genId(), type: 'SELECT', label: 'Estado general inicio', required: true, options: ['Bien', 'Regular', 'Mal'] }] },
    { id: genId(), description: 'Foto inicio banco', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto inicio banco', required: true }] },
    // Control trenza/peines
    { id: genId(), description: 'Trenza que no gire', inputs: [{ id: genId(), type: 'CHECK', label: 'Trenza sin girar', required: true }] },
    { id: genId(), description: 'Desgaste peines', inputs: [{ id: genId(), type: 'SELECT', label: 'Desgaste peines', required: true, options: ['Bien', 'Regular', 'Mal'] }] },
    { id: genId(), description: '¿Gira trenza?', inputs: [{ id: genId(), type: 'CHECK', label: '¿Gira la trenza?', required: true }] },
    // Control hormigón
    { id: genId(), description: 'Control hormigón OK', inputs: [{ id: genId(), type: 'CHECK', label: 'Control hormigón OK', required: true }] },
    // Final banco
    { id: genId(), description: 'Estado final banco', inputs: [{ id: genId(), type: 'SELECT', label: 'Estado final banco', required: true, options: ['Bien', 'Regular', 'Mal'] }] },
    { id: genId(), description: 'Foto final (cabezal terminado)', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto cabezal terminado', required: true }] },
    { id: genId(), description: 'Foto medio banco (separación viguetas)', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto separación viguetas', required: true }] },
    // Cabezales
    { id: genId(), description: 'Limpieza cabezal adelante', inputs: [{ id: genId(), type: 'CHECK', label: 'Cabezal adelante limpio', required: true }] },
    { id: genId(), description: 'Foto cabezal adelante', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto cabezal adelante', required: true }] },
    { id: genId(), description: 'Limpieza cabezal fondo', inputs: [{ id: genId(), type: 'CHECK', label: 'Cabezal fondo limpio', required: true }] },
    { id: genId(), description: 'Foto cabezal fondo', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto cabezal fondo', required: true }] },
    // Tensado - bujes y uñas
    { id: genId(), description: 'Estado bujes OK', inputs: [{ id: genId(), type: 'CHECK', label: 'Bujes en buen estado', required: true }] },
    { id: genId(), description: 'Estado uñas OK', inputs: [{ id: genId(), type: 'CHECK', label: 'Uñas en buen estado', required: true }] },
    { id: genId(), description: 'Colocación correcta', inputs: [{ id: genId(), type: 'CHECK', label: 'Colocación correcta', required: true }] },
    { id: genId(), description: '¿Cuántas uñas?', inputs: [{ id: genId(), type: 'VALUE', label: 'Cantidad de uñas', required: true, unit: 'u' }] },
    { id: genId(), description: 'Ubicación', inputs: [{ id: genId(), type: 'SELECT', label: 'Ubicación', required: true, options: ['Adelante', 'Fondo', 'Ambos'] }] },
    // Fallas
    { id: genId(), description: '¿Hubo falla/defecto?', inputs: [{ id: genId(), type: 'CHECK', label: '¿Hubo falla?', required: true }] },
    { id: genId(), description: 'Descripción falla (si aplica)', inputs: [{ id: genId(), type: 'TEXT', label: 'Descripción de la falla', required: false, placeholder: 'Describir el defecto encontrado' }] },
  ],
};

// ============================================================================
// RUTINA 4: CONTROL CADA 2 BANCOS (Chimango + Cortadora + Paquetes)
// ============================================================================
const RUTINA_CONTROL_2_BANCOS = {
  code: 'VIG_CTRL_2BANCOS',
  name: 'Control cada 2 Bancos',
  type: 'QUALITY',
  frequency: 'EVERY_SHIFT',
  items: [
    // === CHIMANGO / BALANZA / HUMEDAD ===
    { id: genId(), description: '--- CHIMANGO/BALANZA ---', inputs: [{ id: genId(), type: 'TEXT', label: 'Sección', required: false, placeholder: '' }] },
    { id: genId(), description: 'Foto cemento utilizado', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto cemento', required: true }] },
    { id: genId(), description: 'Arrime chimango correcto', inputs: [{ id: genId(), type: 'CHECK', label: 'Arrime chimango OK', required: true }] },
    { id: genId(), description: 'Humedad pedida', inputs: [{ id: genId(), type: 'VALUE', label: 'Humedad pedida', required: true, unit: '%' }] },
    { id: genId(), description: 'Humedad final', inputs: [{ id: genId(), type: 'VALUE', label: 'Humedad final', required: true, unit: '%' }] },
    { id: genId(), description: 'Foto humedad', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto humedad', required: true }] },
    { id: genId(), description: 'Foto parámetros (factor/tiempo)', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto parámetros', required: true }] },
    // === PISTA / VÍAS / DESMOLDANTE ===
    { id: genId(), description: '--- PISTA/VÍAS ---', inputs: [{ id: genId(), type: 'TEXT', label: 'Sección', required: false, placeholder: '' }] },
    { id: genId(), description: 'Limpieza de pista OK', inputs: [{ id: genId(), type: 'CHECK', label: 'Pista limpia', required: true }] },
    { id: genId(), description: 'Limpieza vías puente grúa', inputs: [{ id: genId(), type: 'SELECT', label: 'Estado vías', required: true, options: ['Bien', 'Regular', 'Mal'] }] },
    { id: genId(), description: 'Foto vías puente grúa', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto vías', required: true }] },
    { id: genId(), description: 'Banco Nº (desmoldante)', inputs: [{ id: genId(), type: 'VALUE', label: 'Banco Nº', required: true, unit: '', minValue: 1, maxValue: 12 }] },
    { id: genId(), description: 'Aplicación desmoldante correcta', inputs: [{ id: genId(), type: 'CHECK', label: 'Desmoldante OK', required: true }] },
    { id: genId(), description: 'Foto desmoldante aplicado', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto desmoldante', required: true }] },
    // === CORTADORA ===
    { id: genId(), description: '--- CORTADORA ---', inputs: [{ id: genId(), type: 'TEXT', label: 'Sección', required: false, placeholder: '' }] },
    { id: genId(), description: 'Banco Nº (corte)', inputs: [{ id: genId(), type: 'VALUE', label: 'Banco Nº corte', required: true, unit: '', minValue: 1, maxValue: 12 }] },
    { id: genId(), description: 'Control medida operario OK', inputs: [{ id: genId(), type: 'CHECK', label: 'Medida verificada', required: true }] },
    { id: genId(), description: '¿Hay desperdicio?', inputs: [{ id: genId(), type: 'CHECK', label: '¿Hay desperdicio?', required: true }] },
    { id: genId(), description: 'Metros desperdicio', inputs: [{ id: genId(), type: 'VALUE', label: 'Metros desperdicio', required: false, unit: 'm' }] },
    { id: genId(), description: 'Foto panel cortadora', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto panel', required: true }] },
    { id: genId(), description: '¿Corta alambres de abajo?', inputs: [{ id: genId(), type: 'CHECK', label: 'Corta alambres abajo', required: true }] },
    { id: genId(), description: 'Medida coincide con pedido gerencia', inputs: [{ id: genId(), type: 'CHECK', label: 'Medida = Pedido gerencia', required: true }] },
    // === PAQUETES ===
    { id: genId(), description: '--- PAQUETES ---', inputs: [{ id: genId(), type: 'TEXT', label: 'Sección', required: false, placeholder: '' }] },
    { id: genId(), description: 'Banco Nº (paquete)', inputs: [{ id: genId(), type: 'VALUE', label: 'Banco Nº paquete', required: true, unit: '', minValue: 1, maxValue: 12 }] },
    { id: genId(), description: '¿Fisuras en paquete?', inputs: [{ id: genId(), type: 'CHECK', label: '¿Hay fisuras?', required: true }] },
    { id: genId(), description: 'Posición alambres OK', inputs: [{ id: genId(), type: 'CHECK', label: 'Alambres bien posicionados', required: true }] },
    { id: genId(), description: 'Profundidad corte correcta', inputs: [{ id: genId(), type: 'CHECK', label: 'Profundidad OK', required: true }] },
    { id: genId(), description: 'Control medidas OK', inputs: [{ id: genId(), type: 'CHECK', label: 'Medidas OK', required: true }] },
    { id: genId(), description: 'Foto lejos (pila + ubicación)', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto pila lejos', required: true }] },
    { id: genId(), description: 'Foto cerca (fisuras)', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto cerca fisuras', required: true }] },
    { id: genId(), description: 'Medida OK vs pedido gerencia', inputs: [{ id: genId(), type: 'CHECK', label: 'Confirmado por puentistas', required: true }] },
  ],
};

// ============================================================================
// RUTINA 5: CIERRE DEL DÍA
// ============================================================================
const RUTINA_CIERRE_DIA = {
  code: 'VIG_CIERRE_DIA',
  name: 'Cierre del Día - Viguetas',
  type: 'SHIFT_END',
  frequency: 'DAILY',
  items: [
    // Vapor
    { id: genId(), description: 'Válvulas vapor prendidas', inputs: [{ id: genId(), type: 'CHECK', label: 'Válvulas vapor ON', required: true }] },
    { id: genId(), description: 'Pérdidas vapor conexión válvula-carpas', inputs: [{ id: genId(), type: 'CHECK', label: '¿Hay pérdidas de vapor?', required: true }] },
    { id: genId(), description: 'Prueba funcional caldera (si nocturna)', inputs: [{ id: genId(), type: 'CHECK', label: 'Prueba caldera OK', required: false }] },
    // Riego
    { id: genId(), description: 'Bancos a regar', inputs: [{ id: genId(), type: 'CHECKBOX', label: 'Bancos a regar', required: true, options: ['Banco 1', 'Banco 2', 'Banco 3', 'Banco 4', 'Banco 5', 'Banco 6', 'Banco 7', 'Banco 8', 'Banco 9', 'Banco 10', 'Banco 11', 'Banco 12'] }] },
    { id: genId(), description: 'Horario riego', inputs: [{ id: genId(), type: 'TIME', label: 'Horario riego', required: true }] },
    // Cortadora
    { id: genId(), description: '¿Cortadora queda en marcha?', inputs: [{ id: genId(), type: 'CHECK', label: 'Cortadora en marcha', required: true }] },
    { id: genId(), description: 'Cortadora tapada (si apagada)', inputs: [{ id: genId(), type: 'CHECK', label: 'Cortadora tapada', required: false }] },
    // Producción
    { id: genId(), description: 'Cantidad bancos producidos', inputs: [{ id: genId(), type: 'VALUE', label: 'Bancos producidos', required: true, unit: 'u', minValue: 0, maxValue: 12 }] },
    { id: genId(), description: 'Orden herramientas', inputs: [{ id: genId(), type: 'CHECK', label: 'Herramientas ordenadas', required: true }] },
    { id: genId(), description: 'Orden y limpieza general', inputs: [{ id: genId(), type: 'CHECK', label: 'Limpieza general OK', required: true }] },
    { id: genId(), description: 'Sala comando (luz/aire/tablero apagados)', inputs: [{ id: genId(), type: 'CHECK', label: 'Sala comando apagada', required: true }] },
    // Cortes mal
    { id: genId(), description: '¿Cortes mal de medida?', inputs: [{ id: genId(), type: 'CHECK', label: '¿Hubo cortes mal?', required: true }] },
    { id: genId(), description: 'Detalle cortes mal', inputs: [{ id: genId(), type: 'TEXT', label: 'Detalle cortes mal', required: false, placeholder: 'Describir los cortes con problemas' }] },
    // Bombas
    { id: genId(), description: 'Bombas sumergibles apagadas', inputs: [{ id: genId(), type: 'CHECK', label: 'Bombas apagadas', required: true }] },
    // Carpas
    { id: genId(), description: 'Estado carpas bancos 1-8', inputs: [{ id: genId(), type: 'SELECT', label: 'Carpas 1-8', required: true, options: ['OK', 'Revisar', 'Mal'] }] },
    { id: genId(), description: 'Estado carpas bancos 9-12', inputs: [{ id: genId(), type: 'SELECT', label: 'Carpas 9-12', required: true, options: ['OK', 'Revisar', 'Mal'] }] },
    // Fotos WhatsApp guardia
    { id: genId(), description: 'Foto bancos a quemar', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto bancos a quemar', required: true }] },
    { id: genId(), description: 'Foto parámetros vapor', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto parámetros vapor', required: true }] },
    // Firma
    { id: genId(), description: 'Firma supervisor', inputs: [{ id: genId(), type: 'SIGNATURE', label: 'Firma supervisor', required: true }] },
  ],
};

// ============================================================================
// FUNCIÓN PRINCIPAL DE SEED
// ============================================================================
async function seedRutinasViguetas(companyId: number) {
  const rutinas = [
    RUTINA_INICIO_DIA,
    RUTINA_CONTROL_ARIDOS,
    RUTINA_CONTROL_BANCO,
    RUTINA_CONTROL_2_BANCOS,
    RUTINA_CIERRE_DIA,
  ];

  const results = [];

  for (const rutina of rutinas) {
    // Check if already exists
    const existing = await prisma.productionRoutineTemplate.findFirst({
      where: { companyId, code: rutina.code },
    });

    if (existing) {
      console.log(`⏭️  Rutina "${rutina.name}" ya existe, saltando...`);
      results.push({ code: rutina.code, status: 'skipped' });
      continue;
    }

    // Create
    const itemsData = {
      itemsStructure: 'flat',
      items: rutina.items,
      groups: null,
      preExecutionInputs: [],
    };

    const template = await prisma.productionRoutineTemplate.create({
      data: {
        code: rutina.code,
        name: rutina.name,
        type: rutina.type,
        frequency: rutina.frequency,
        items: itemsData,
        isActive: true,
        companyId,
      },
    });

    console.log(`✅ Rutina "${rutina.name}" creada (ID: ${template.id})`);
    results.push({ code: rutina.code, status: 'created', id: template.id });
  }

  return results;
}

// Export for API use
export { seedRutinasViguetas };

// Direct execution
async function main() {
  // Get first company (for testing) or pass as argument
  const companyId = parseInt(process.argv[2]) || 1;

  console.log(`\n🏭 Seeding rutinas de viguetas para companyId: ${companyId}\n`);

  try {
    const results = await seedRutinasViguetas(companyId);
    console.log('\n📊 Resumen:');
    console.table(results);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}
