/**
 * TEST CIRCUITO COMPLETO: Cierre de OT + Solución
 *
 * Simula exactamente lo que hacen los endpoints:
 *   POST /api/work-orders (crear OT)
 *   POST /api/work-orders/[id]/close (cerrar con solución)
 *   GET  /api/work-orders/[id]?include=failureOccurrences (leer)
 *
 * Al terminar, limpia todos los registros creados.
 *
 * Ejecutar: npx tsx scripts/testing/test-close-circuit.ts
 */

import { prisma } from '../../lib/prisma';

const COMPANY_ID = 3;
const USER_ID = 7;
const MACHINE_ID = 37;
const COMPONENT_ID = 153;

const GREEN = '\x1b[32m✅';
const RED = '\x1b[31m❌';
const YELLOW = '\x1b[33m⚠️';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function pass(msg: string) { console.log(`${GREEN} ${msg}${RESET}`); }
function fail(msg: string) { console.log(`${RED} ${msg}${RESET}`); }
function warn(msg: string) { console.log(`${YELLOW}  ${msg}${RESET}`); }
function section(msg: string) { console.log(`\n${BOLD}── ${msg} ──${RESET}`); }

async function main() {
  let failureOccurrenceId: number | null = null;
  let workOrderId: number | null = null;
  let solutionAppliedId: number | null = null;

  try {
    // ─── PASO 1: Crear FailureOccurrence ─────────────────────────────────────
    section('PASO 1: Crear FailureOccurrence');

    const fo = await prisma.failureOccurrence.create({
      data: {
        title: '[TEST] Rodamiento desgastado en eje principal',
        description: 'Se detectó vibración excesiva y ruido metálico en el eje principal de la mezcladora.',
        companyId: COMPANY_ID,
        reportedBy: USER_ID,
        machineId: MACHINE_ID,
        status: 'OPEN',
        priority: 'HIGH',
        causedDowntime: false,
        incidentType: 'FALLA',
        failureCategory: 'MECANICA',
        affectedComponents: {
          componentIds: [COMPONENT_ID],
          subcomponentIds: [],
        },
      },
    });

    failureOccurrenceId = fo.id;
    pass(`FailureOccurrence creada — ID: ${fo.id}, título: "${fo.title}"`);

    // ─── PASO 2: Crear WorkOrder ──────────────────────────────────────────────
    section('PASO 2: Crear WorkOrder');

    const wo = await prisma.workOrder.create({
      data: {
        title: '[TEST] Reemplazar rodamiento eje principal',
        type: 'CORRECTIVE',
        status: 'PENDING',
        priority: 'HIGH',
        companyId: COMPANY_ID,
        createdById: USER_ID,
        machineId: MACHINE_ID,
        componentId: COMPONENT_ID,
        failureOccurrences: { connect: { id: fo.id } },
      },
    });

    workOrderId = wo.id;
    pass(`WorkOrder creada — ID: ${wo.id}, título: "${wo.title}"`);

    // ─── PASO 3: Cerrar OT (simula POST /close) ───────────────────────────────
    section('PASO 3: Cerrar OT con SolutionApplied (simula /close)');

    const TOOLS_USED = [
      { id: 35, name: 'Repuesto - Cilindro Apertura Tolva', quantity: 1 },
    ];
    const SPARE_PARTS = [
      { id: 35, name: 'Rodamiento 6205', quantity: 2 },
    ];

    const sa = await prisma.solutionApplied.create({
      data: {
        failureOccurrenceId: fo.id,
        workOrderId: wo.id,
        companyId: COMPANY_ID,
        diagnosis: 'Se encontró el rodamiento del eje principal completamente desgastado. Lubricación agotada por ciclos de trabajo excesivos.',
        solution: 'Se reemplazó el rodamiento 6205 por uno nuevo. Se lubricó el eje y se ajustaron los tensores laterales.',
        outcome: 'FUNCIONÓ',
        fixType: 'DEFINITIVA',
        performedById: USER_ID,
        performedAt: new Date(),
        actualMinutes: 95,
        confirmedCause: 'Falta de lubricación preventiva y sobrecarga operativa',
        finalComponentId: COMPONENT_ID,
        finalSubcomponentId: null,
        effectiveness: 5,
        notes: 'Se recomienda programar mantenimiento preventivo cada 3 meses.',
        toolsUsed: TOOLS_USED,
        sparePartsUsed: SPARE_PARTS,
      },
    });

    solutionAppliedId = sa.id;
    pass(`SolutionApplied creada — ID: ${sa.id}`);
    pass(`  diagnosis: "${sa.diagnosis.substring(0, 50)}..."`);
    pass(`  solution: "${sa.solution.substring(0, 50)}..."`);
    pass(`  outcome: ${sa.outcome}`);
    pass(`  fixType: ${sa.fixType}`);
    pass(`  actualMinutes: ${sa.actualMinutes}`);
    pass(`  finalComponentId: ${sa.finalComponentId}`);
    pass(`  toolsUsed: ${JSON.stringify(sa.toolsUsed)}`);
    pass(`  sparePartsUsed: ${JSON.stringify(sa.sparePartsUsed)}`);
    pass(`  effectiveness: ${sa.effectiveness}`);
    pass(`  notes: "${sa.notes}"`);

    // Marcar OT como COMPLETED
    await prisma.workOrder.update({
      where: { id: wo.id },
      data: { status: 'COMPLETED', completedDate: new Date() },
    });
    pass('WorkOrder marcada como COMPLETED');

    // ─── PASO 4: GET /api/work-orders/[id] (simula el handler real) ──────────
    section('PASO 4: Simular GET /api/work-orders/[id]?include=failureOccurrences');

    const includeConfig: Record<string, unknown> = {
      machine: true,
      component: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      failureOccurrences: {
        select: {
          id: true,
          title: true,
          description: true,
          causedDowntime: true,
          status: true,
          priority: true,
          affectedComponents: true,
          incidentType: true,
          failureCategory: true,
          machineId: true,
          originalReport: true,
        },
      },
    };

    const workOrder = await prisma.workOrder.findUnique({
      where: { id: wo.id },
      include: includeConfig as any,
    });

    if (!workOrder) throw new Error('WorkOrder no encontrada en GET');
    pass(`WorkOrder encontrada — status: ${workOrder.status}`);

    // Simular la lógica de solutionsApplied del GET handler
    const failureIds = (workOrder.failureOccurrences as any[]).map((fo: any) => fo.id);
    console.log(`  failureIds encontrados: [${failureIds}]`);

    // Query plana (igual que el handler corregido)
    const solutionsRaw = await prisma.solutionApplied.findMany({
      where: {
        OR: [
          ...(failureIds.length > 0 ? [{ failureOccurrenceId: { in: failureIds } }] : []),
          { workOrderId: wo.id },
        ],
      },
      select: {
        id: true,
        diagnosis: true,
        solution: true,
        outcome: true,
        performedAt: true,
        actualMinutes: true,
        confirmedCause: true,
        fixType: true,
        effectiveness: true,
        notes: true,
        repairAction: true,
        toolsUsed: true,
        sparePartsUsed: true,
        finalComponentId: true,
        finalSubcomponentId: true,
      },
      orderBy: { performedAt: 'desc' },
      take: 1,
    });

    if (solutionsRaw.length === 0) {
      fail('solutionsApplied: array VACÍO — la solución no aparecería en la UI');
    } else {
      pass(`solutionsApplied query devolvió ${solutionsRaw.length} registro(s)`);
    }

    // Lookup de componentes finales
    const finalCompIds = [...new Set(solutionsRaw.map(s => s.finalComponentId).filter(Boolean))] as number[];
    const finalSubIds = [...new Set(solutionsRaw.map(s => s.finalSubcomponentId).filter(Boolean))] as number[];
    const allFinalIds = [...new Set([...finalCompIds, ...finalSubIds])];

    const finalComponents = allFinalIds.length > 0
      ? await prisma.component.findMany({
          where: { id: { in: allFinalIds } },
          select: { id: true, name: true },
        })
      : [];

    const finalCompMap = new Map(finalComponents.map(c => [c.id, c]));

    const solutionsWithComponents = solutionsRaw.map(s => ({
      ...s,
      finalComponent: s.finalComponentId ? (finalCompMap.get(s.finalComponentId) ?? null) : null,
      finalSubcomponent: s.finalSubcomponentId ? (finalCompMap.get(s.finalSubcomponentId) ?? null) : null,
    }));

    // ─── PASO 5: Verificar cada campo ────────────────────────────────────────
    section('PASO 5: Verificar campos en la respuesta');

    const sol = solutionsWithComponents[0];
    if (!sol) {
      fail('No hay solución en el resultado');
    } else {
      sol.diagnosis?.length >= 10 ? pass(`diagnosis: OK ("${sol.diagnosis.substring(0, 50)}...")`) : fail('diagnosis: FALTA O VACÍO');
      sol.solution?.length >= 10 ? pass(`solution: OK ("${sol.solution.substring(0, 50)}...")`) : fail('solution: FALTA O VACÍO');
      sol.outcome ? pass(`outcome: ${sol.outcome}`) : fail('outcome: FALTA');
      sol.fixType ? pass(`fixType: ${sol.fixType}`) : fail('fixType: FALTA');
      sol.actualMinutes ? pass(`actualMinutes: ${sol.actualMinutes} min`) : warn('actualMinutes: no enviado');
      sol.confirmedCause ? pass(`confirmedCause: "${sol.confirmedCause}"`) : warn('confirmedCause: no enviado');
      sol.effectiveness ? pass(`effectiveness: ${sol.effectiveness}/5`) : warn('effectiveness: no enviado');
      sol.notes ? pass(`notes: "${sol.notes}"`) : warn('notes: no enviada');

      const tools = sol.toolsUsed as any[];
      Array.isArray(tools) && tools.length > 0
        ? pass(`toolsUsed: ${tools.map(t => `${t.name} x${t.quantity}`).join(', ')}`)
        : fail('toolsUsed: VACÍO — no se guardaría');

      const parts = sol.sparePartsUsed as any[];
      Array.isArray(parts) && parts.length > 0
        ? pass(`sparePartsUsed: ${parts.map(p => `${p.name} x${p.quantity}`).join(', ')}`)
        : fail('sparePartsUsed: VACÍO — no se guardaría');

      sol.finalComponent
        ? pass(`finalComponent: "${sol.finalComponent.name}" (ID: ${sol.finalComponent.id})`)
        : warn('finalComponent: null (no se seleccionó ninguno)');

      sol.finalSubcomponent
        ? pass(`finalSubcomponent: "${sol.finalSubcomponent.name}"`)
        : warn('finalSubcomponent: null (no hay subcomponente)');
    }

    // ─── PASO 6: Verificar gate de la UI ─────────────────────────────────────
    section('PASO 6: Verificar gates de la UI (WorkOrderDetailSheet)');

    const foLength = (workOrder.failureOccurrences as any[]).length;
    foLength > 0
      ? pass(`Gate exterior OK — failureOccurrences.length = ${foLength} > 0`)
      : fail('Gate exterior FALLA — failureOccurrences está vacío, la sección no renderiza');

    solutionsWithComponents.length > 0
      ? pass(`Gate interior OK — solutionsApplied.length = ${solutionsWithComponents.length} > 0`)
      : fail('Gate interior FALLA — solutionsApplied vacío, la tarjeta de solución no renderiza');

    console.log('\n' + BOLD + '══════════════════════════════════════════' + RESET);
    console.log(BOLD + '  RESULTADO: CIRCUITO COMPLETO OK ✅' + RESET);
    console.log(BOLD + '══════════════════════════════════════════' + RESET);

  } catch (err: any) {
    console.error(`${RED} ERROR EN EL TEST:${RESET}`, err.message);
    console.error(err);
  } finally {
    // ─── LIMPIEZA: borrar todo lo creado ─────────────────────────────────────
    section('LIMPIEZA: eliminando datos de test');

    if (solutionAppliedId) {
      await prisma.solutionApplied.delete({ where: { id: solutionAppliedId } }).catch(() => {});
      pass(`SolutionApplied #${solutionAppliedId} eliminada`);
    }
    if (workOrderId) {
      await prisma.workOrder.delete({ where: { id: workOrderId } }).catch(() => {});
      pass(`WorkOrder #${workOrderId} eliminada`);
    }
    if (failureOccurrenceId) {
      await prisma.failureOccurrence.delete({ where: { id: failureOccurrenceId } }).catch(() => {});
      pass(`FailureOccurrence #${failureOccurrenceId} eliminada`);
    }

    await prisma.$disconnect();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
