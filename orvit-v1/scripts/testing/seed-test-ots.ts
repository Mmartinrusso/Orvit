/**
 * SEED: Crear OTs de prueba REALES en la DB
 *
 * Crea y deja en la DB:
 *   [A] OT CERRADA  — con falla + solución completa (herramientas, repuestos, componente)
 *   [B] OT ABIERTA  — con falla sin solución (para verificar que no rompe nada)
 *
 * Ejecutar: npx tsx scripts/testing/seed-test-ots.ts
 * Limpiar:  npx tsx scripts/testing/seed-test-ots.ts --clean <idA> <idB>
 */

import { prisma } from '../../lib/prisma';

const COMPANY_ID = 3;
const USER_ID = 7;
const MACHINE_ID = 37;
const COMPONENT_ID = 153;

const GREEN  = '\x1b[32m✅';
const RED    = '\x1b[31m❌';
const YELLOW = '\x1b[33m⚠️ ';
const CYAN   = '\x1b[36m🔵';
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';

function pass(msg: string)    { console.log(`${GREEN} ${msg}${RESET}`); }
function fail(msg: string)    { console.log(`${RED} ${msg}${RESET}`); }
function warn(msg: string)    { console.log(`${YELLOW} ${msg}${RESET}`); }
function info(msg: string)    { console.log(`${CYAN} ${msg}${RESET}`); }
function section(msg: string) { console.log(`\n${BOLD}── ${msg} ──${RESET}`); }

// ─── MODO LIMPIEZA ────────────────────────────────────────────────────────────
async function clean(woIdA: number, woIdB: number) {
  section('LIMPIEZA');

  // Buscar soluciones y fallas asociadas
  const woA = await prisma.workOrder.findUnique({
    where: { id: woIdA },
    include: { failureOccurrences: { select: { id: true } }, solutionsApplied: { select: { id: true } } }
  });
  const woB = await prisma.workOrder.findUnique({
    where: { id: woIdB },
    include: { failureOccurrences: { select: { id: true } } }
  });

  if (woA) {
    for (const sa of (woA as any).solutionsApplied || []) {
      await prisma.solutionApplied.delete({ where: { id: sa.id } }).catch(() => {});
      pass(`SolutionApplied #${sa.id} eliminada`);
    }
    await prisma.workOrder.delete({ where: { id: woIdA } }).catch(() => {});
    pass(`WorkOrder #${woIdA} (CERRADA) eliminada`);
    for (const fo of woA.failureOccurrences) {
      await prisma.failureOccurrence.delete({ where: { id: fo.id } }).catch(() => {});
      pass(`FailureOccurrence #${fo.id} eliminada`);
    }
  }

  if (woB) {
    await prisma.workOrder.delete({ where: { id: woIdB } }).catch(() => {});
    pass(`WorkOrder #${woIdB} (ABIERTA) eliminada`);
    for (const fo of woB.failureOccurrences) {
      await prisma.failureOccurrence.delete({ where: { id: fo.id } }).catch(() => {});
      pass(`FailureOccurrence #${fo.id} eliminada`);
    }
  }

  await prisma.$disconnect();
  return;
}

// ─── MODO SEED + VERIFICACIÓN ─────────────────────────────────────────────────
async function seed() {
  let foIdA: number, woIdA: number, saId: number;
  let foIdB: number, woIdB: number;

  // ══════════════════════════════════════════════════
  // CASO A: OT CERRADA CON SOLUCIÓN COMPLETA
  // ══════════════════════════════════════════════════
  section('CASO A: Crear OT CERRADA con solución completa');

  const foA = await prisma.failureOccurrence.create({
    data: {
      title: '[TEST-A] Correa de transmisión rota en tambor principal',
      description: 'Operario reportó parada súbita del tambor. Se detectó correa partida en la zona de transmisión.',
      companyId: COMPANY_ID,
      reportedBy: USER_ID,
      machineId: MACHINE_ID,
      status: 'RESOLVED',
      priority: 'URGENT',
      causedDowntime: true,
      incidentType: 'ROTURA',
      failureCategory: 'MECANICA',
      affectedComponents: { componentIds: [COMPONENT_ID], subcomponentIds: [] },
    },
  });
  foIdA = foA.id;
  pass(`FailureOccurrence A creada — ID: ${foA.id} | "${foA.title}"`);

  const woA = await prisma.workOrder.create({
    data: {
      title: '[TEST-A] Reemplazo correa de transmisión',
      type: 'CORRECTIVE',
      status: 'COMPLETED',
      priority: 'URGENT',
      companyId: COMPANY_ID,
      createdById: USER_ID,
      assignedToId: USER_ID,
      machineId: MACHINE_ID,
      componentId: COMPONENT_ID,
      completedDate: new Date(),
      actualHours: 1.5,
      failureOccurrences: { connect: { id: foA.id } },
    },
  });
  woIdA = woA.id;
  pass(`WorkOrder A creada — ID: ${woA.id} | status: COMPLETED`);

  const sa = await prisma.solutionApplied.create({
    data: {
      failureOccurrenceId: foA.id,
      workOrderId: woA.id,
      companyId: COMPANY_ID,
      performedById: USER_ID,
      performedAt: new Date(),
      diagnosis: 'Correa de transmisión completamente partida por fatiga del material y tensión excesiva. Signos de desgaste previo no detectados.',
      solution: 'Se reemplazó la correa de transmisión por una nueva (referencia BX-82). Se ajustó la tensión al valor nominal (12 N/mm). Se lubricaron los tensores.',
      outcome: 'FUNCIONÓ',
      fixType: 'DEFINITIVA',
      actualMinutes: 90,
      confirmedCause: 'Fatiga del material por tensión excesiva y falta de mantenimiento preventivo',
      finalComponentId: COMPONENT_ID,
      finalSubcomponentId: null,
      effectiveness: 5,
      notes: 'Programar inspección de correas cada 500 horas de operación.',
      repairAction: 'CAMBIO',
      toolsUsed: [
        { id: 35, name: 'Llave de tensión', quantity: 1 },
      ],
      sparePartsUsed: [
        { id: 35, name: 'Correa BX-82', quantity: 1 },
      ],
    },
  });
  saId = sa.id;
  pass(`SolutionApplied creada — ID: ${sa.id}`);
  pass(`  diagnosis: "${sa.diagnosis.substring(0, 60)}..."`);
  pass(`  solution:  "${sa.solution.substring(0, 60)}..."`);
  pass(`  outcome: ${sa.outcome} | fixType: ${sa.fixType}`);
  pass(`  actualMinutes: ${sa.actualMinutes} | effectiveness: ${sa.effectiveness}/5`);
  pass(`  confirmedCause: "${sa.confirmedCause}"`);
  pass(`  toolsUsed: ${JSON.stringify(sa.toolsUsed)}`);
  pass(`  sparePartsUsed: ${JSON.stringify(sa.sparePartsUsed)}`);
  pass(`  finalComponentId: ${sa.finalComponentId}`);
  pass(`  notes: "${sa.notes}"`);

  // ══════════════════════════════════════════════════
  // CASO B: OT ABIERTA SIN SOLUCIÓN
  // ══════════════════════════════════════════════════
  section('CASO B: Crear OT ABIERTA sin solución');

  const foB = await prisma.failureOccurrence.create({
    data: {
      title: '[TEST-B] Vibración anormal en rodamientos del eje secundario',
      description: 'Se escucha ruido metálico intermitente en el eje secundario durante operación a plena carga.',
      companyId: COMPANY_ID,
      reportedBy: USER_ID,
      machineId: MACHINE_ID,
      status: 'OPEN',
      priority: 'HIGH',
      causedDowntime: false,
      incidentType: 'FALLA',
      failureCategory: 'MECANICA',
      affectedComponents: { componentIds: [COMPONENT_ID], subcomponentIds: [] },
    },
  });
  foIdB = foB.id;
  pass(`FailureOccurrence B creada — ID: ${foB.id} | "${foB.title}"`);

  const woB = await prisma.workOrder.create({
    data: {
      title: '[TEST-B] Inspección y reparación rodamientos eje secundario',
      type: 'CORRECTIVE',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      companyId: COMPANY_ID,
      createdById: USER_ID,
      assignedToId: USER_ID,
      machineId: MACHINE_ID,
      componentId: COMPONENT_ID,
      startedDate: new Date(),
      failureOccurrences: { connect: { id: foB.id } },
    },
  });
  woIdB = woB.id;
  pass(`WorkOrder B creada — ID: ${woB.id} | status: IN_PROGRESS | sin SolutionApplied`);

  // ══════════════════════════════════════════════════
  // VERIFICACIÓN: Simular GET para ambas OTs
  // ══════════════════════════════════════════════════
  section('VERIFICACIÓN GET — CASO A (cerrada con solución)');

  await verifyGetResponse(woIdA, 'A');

  section('VERIFICACIÓN GET — CASO B (abierta sin solución)');

  await verifyGetResponse(woIdB, 'B');

  // ══════════════════════════════════════════════════
  // RESUMEN FINAL
  // ══════════════════════════════════════════════════
  console.log(`
${BOLD}══════════════════════════════════════════════════════════${RESET}
${BOLD}  DATOS CREADOS EN LA DB — ABRÍ LA APP Y VERIFICÁ${RESET}
${BOLD}══════════════════════════════════════════════════════════${RESET}

${BOLD}[A] OT CERRADA con solución completa:${RESET}
    WorkOrder ID:          ${woIdA}
    FailureOccurrence ID:  ${foIdA}
    SolutionApplied ID:    ${saId}
    Título:                "[TEST-A] Reemplazo correa de transmisión"

${BOLD}[B] OT ABIERTA sin solución:${RESET}
    WorkOrder ID:          ${woIdB}
    FailureOccurrence ID:  ${foIdB}
    Título:                "[TEST-B] Inspección rodamientos eje secundario"

${BOLD}Para limpiar después:${RESET}
    npx tsx scripts/testing/seed-test-ots.ts --clean ${woIdA} ${woIdB}
${BOLD}══════════════════════════════════════════════════════════${RESET}
  `);

  await prisma.$disconnect();
}

// ─── Simula el GET /api/work-orders/[id] exactamente ─────────────────────────
async function verifyGetResponse(workOrderId: number, label: string) {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      machine: true,
      component: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      failureOccurrences: {
        select: {
          id: true, title: true, description: true, causedDowntime: true,
          status: true, priority: true, affectedComponents: true,
          incidentType: true, failureCategory: true, machineId: true, originalReport: true,
        },
      },
    } as any,
  });

  if (!workOrder) { fail(`WorkOrder ${workOrderId} no encontrada`); return; }

  const failureOccurrences = (workOrder as any).failureOccurrences as any[];
  const failureIds = failureOccurrences.map((fo: any) => fo.id);
  info(`failureOccurrences en respuesta: ${failureIds.length} | IDs: [${failureIds}]`);

  // Query solutionsApplied (lógica corregida del handler)
  const solutionsRaw = await prisma.solutionApplied.findMany({
    where: {
      OR: [
        ...(failureIds.length > 0 ? [{ failureOccurrenceId: { in: failureIds } }] : []),
        { workOrderId },
      ],
    },
    select: {
      id: true, diagnosis: true, solution: true, outcome: true,
      performedAt: true, actualMinutes: true, confirmedCause: true,
      fixType: true, effectiveness: true, notes: true, repairAction: true,
      toolsUsed: true, sparePartsUsed: true,
      finalComponentId: true, finalSubcomponentId: true,
    },
    orderBy: { performedAt: 'desc' },
    take: 1,
  });

  info(`solutionsApplied encontrados: ${solutionsRaw.length}`);

  // Lookup de nombres de componentes
  const finalIds = [...new Set([
    ...solutionsRaw.map(s => s.finalComponentId),
    ...solutionsRaw.map(s => s.finalSubcomponentId),
  ].filter(Boolean))] as number[];

  const finalComps = finalIds.length > 0
    ? await prisma.component.findMany({ where: { id: { in: finalIds } }, select: { id: true, name: true } })
    : [];
  const compMap = new Map(finalComps.map(c => [c.id, c]));

  const solutions = solutionsRaw.map(s => ({
    ...s,
    finalComponent: s.finalComponentId ? compMap.get(s.finalComponentId) ?? null : null,
    finalSubcomponent: s.finalSubcomponentId ? compMap.get(s.finalSubcomponentId) ?? null : null,
  }));

  // Verificar gates de UI
  const gateExterior = failureOccurrences.length > 0;
  const gateInterior = solutions.length > 0;

  gateExterior
    ? pass(`[${label}] Gate exterior (failureOccurrences > 0): OK`)
    : warn(`[${label}] Gate exterior FALLA → sección completa oculta en UI`);

  if (gateExterior && gateInterior) {
    const sol = solutions[0];
    pass(`[${label}] Gate interior (solutionsApplied > 0): OK`);
    pass(`[${label}] diagnosis:       "${sol.diagnosis.substring(0, 55)}..."`);
    pass(`[${label}] solution:        "${sol.solution.substring(0, 55)}..."`);
    pass(`[${label}] outcome:         ${sol.outcome}`);
    pass(`[${label}] fixType:         ${sol.fixType}`);
    pass(`[${label}] actualMinutes:   ${sol.actualMinutes}`);
    pass(`[${label}] confirmedCause:  "${sol.confirmedCause}"`);
    pass(`[${label}] effectiveness:   ${sol.effectiveness}/5`);
    pass(`[${label}] notes:           "${sol.notes}"`);
    pass(`[${label}] toolsUsed:       ${JSON.stringify(sol.toolsUsed)}`);
    pass(`[${label}] sparePartsUsed:  ${JSON.stringify(sol.sparePartsUsed)}`);
    pass(`[${label}] finalComponent:  ${sol.finalComponent ? `"${sol.finalComponent.name}"` : 'null'}`);
  } else if (gateExterior && !gateInterior) {
    warn(`[${label}] No hay solutionsApplied → tarjeta de solución oculta (esperado para OT abierta)`);
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args[0] === '--clean' && args[1] && args[2]) {
  clean(Number(args[1]), Number(args[2])).catch(e => { console.error(e); process.exit(1); });
} else {
  seed().catch(e => { console.error(e); process.exit(1); });
}
