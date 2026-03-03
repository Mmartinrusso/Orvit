/**
 * Cierra OT #190 ([TEST-B]) con:
 *   - SolutionApplied completa (herramientas, repuestos, causa, notas)
 *   - Corrección de la falla: el problema real era diferente al reportado
 *
 * Ejecutar: npx tsx scripts/testing/close-ot-190.ts
 */

import { prisma } from '../../lib/prisma';

const GREEN  = '\x1b[32m✅';
const RED    = '\x1b[31m❌';
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';

function pass(msg: string) { console.log(`${GREEN} ${msg}${RESET}`); }
function fail(msg: string) { console.log(`${RED} ${msg}${RESET}`); }
function section(msg: string) { console.log(`\n${BOLD}── ${msg} ──${RESET}`); }

const WO_ID = 190;
const FO_ID = 90;
const USER_ID = 7;
const COMPANY_ID = 3;
const COMPONENT_ID = 153;

async function main() {
  section('Verificar estado actual');

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: WO_ID },
    include: {
      failureOccurrences: {
        select: { id: true, title: true, originalReport: true, status: true }
      }
    }
  });

  if (!workOrder) { fail(`WorkOrder #${WO_ID} no encontrada`); return; }
  pass(`WorkOrder #${WO_ID} — status: ${workOrder.status}`);

  const fo = workOrder.failureOccurrences.find(f => f.id === FO_ID);
  if (!fo) { fail(`FailureOccurrence #${FO_ID} no linkeada a esta OT`); return; }
  pass(`FailureOccurrence #${FO_ID} — "${fo.title}"`);

  // ─── PASO 1: Crear SolutionApplied ─────────────────────────────────────────
  section('PASO 1: Crear SolutionApplied');

  const sa = await prisma.solutionApplied.create({
    data: {
      failureOccurrenceId: FO_ID,
      workOrderId: WO_ID,
      companyId: COMPANY_ID,
      performedById: USER_ID,
      performedAt: new Date(),
      // Diagnóstico: lo que realmente encontró el técnico
      diagnosis: 'Tras inspección se detectó eje secundario doblado por impacto previo no reportado. Los rodamientos estaban en buen estado — el ruido era consecuencia del eje doblado y no de los rodamientos.',
      solution: 'Se reemplazó el eje secundario completo por repuesto nuevo. Se verificó alineación con galga. Se lubricaron rodamientos preventivamente. Se retornó a producción con prueba de marcha de 30 minutos sin anomalías.',
      outcome: 'FUNCIONÓ',
      fixType: 'DEFINITIVA',
      actualMinutes: 140,
      confirmedCause: 'Eje doblado por impacto externo (golpe de cuerpo extraño durante operación)',
      finalComponentId: COMPONENT_ID,
      finalSubcomponentId: null,
      effectiveness: 4,
      notes: 'Revisar protecciones laterales del tambor para evitar ingreso de cuerpos extraños. Informar a operarios.',
      repairAction: 'CAMBIO',
      toolsUsed: [
        { id: 35, name: 'Extractor de ejes', quantity: 1 },
      ],
      sparePartsUsed: [
        { id: 35, name: 'Eje secundario Ø32mm', quantity: 1 },
      ],
    },
  });
  pass(`SolutionApplied creada — ID: ${sa.id}`);
  pass(`  outcome: ${sa.outcome} | fixType: ${sa.fixType} | actualMinutes: ${sa.actualMinutes}`);
  pass(`  finalComponentId: ${sa.finalComponentId}`);
  pass(`  toolsUsed: ${JSON.stringify(sa.toolsUsed)}`);
  pass(`  sparePartsUsed: ${JSON.stringify(sa.sparePartsUsed)}`);

  // ─── PASO 2: Corregir FailureOccurrence ────────────────────────────────────
  section('PASO 2: Corregir FailureOccurrence (la falla real era otra)');

  // Guardar snapshot del reporte original (si no fue corregida antes)
  const originalSnapshot = fo.originalReport ?? {
    title: fo.title,
    description: '[TEST-B] Se escucha ruido metálico intermitente en el eje secundario durante operación a plena carga.',
    machineId: 37,
    subcomponentId: null,
    affectedComponents: { componentIds: [COMPONENT_ID], subcomponentIds: [] },
    failureCategory: 'MECANICA',
    incidentType: 'FALLA',
  };

  await prisma.failureOccurrence.update({
    where: { id: FO_ID },
    data: {
      // Snapshot original (primera vez)
      originalReport: fo.originalReport ? fo.originalReport : originalSnapshot,
      correctedAt: new Date(),
      correctedById: USER_ID,

      // Datos corregidos (lo que era en realidad)
      title: '[TEST-B CORREGIDA] Eje secundario doblado — mal diagnosticado como rodamientos',
      description: 'Diagnóstico inicial incorrecto: los rodamientos estaban en buen estado. El problema real era el eje secundario doblado por un impacto previo no reportado.',
      incidentType: 'ROTURA',
      failureCategory: 'MECANICA',
      status: 'RESOLVED',
      resolvedAt: new Date(),
    },
  });
  pass(`FailureOccurrence #${FO_ID} corregida:`);
  pass(`  Título corregido: "Eje secundario doblado — mal diagnosticado como rodamientos"`);
  pass(`  originalReport guardado: ${fo.originalReport ? 'ya existía (no se pisó)' : 'guardado por primera vez'}`);
  pass(`  incidentType: FALLA → ROTURA`);
  pass(`  status: RESOLVED`);

  // ─── PASO 3: Cerrar WorkOrder ───────────────────────────────────────────────
  section('PASO 3: Cerrar WorkOrder #190');

  await prisma.workOrder.update({
    where: { id: WO_ID },
    data: {
      status: 'COMPLETED',
      completedDate: new Date(),
      actualHours: 140 / 60,
    },
  });
  pass(`WorkOrder #${WO_ID} → COMPLETED`);

  // ─── PASO 4: Verificar GET ──────────────────────────────────────────────────
  section('PASO 4: Verificar GET (simular WorkOrderDetailSheet)');

  const verifyWO = await prisma.workOrder.findUnique({
    where: { id: WO_ID },
    include: {
      machine: true,
      component: true,
      failureOccurrences: {
        select: {
          id: true, title: true, causedDowntime: true, originalReport: true,
          correctedAt: true, status: true, incidentType: true,
        }
      },
    } as any,
  });

  const failureIds = (verifyWO as any).failureOccurrences.map((f: any) => f.id);
  const solutionsRaw = await prisma.solutionApplied.findMany({
    where: { OR: [{ failureOccurrenceId: { in: failureIds } }, { workOrderId: WO_ID }] },
    select: {
      id: true, diagnosis: true, solution: true, outcome: true, actualMinutes: true,
      confirmedCause: true, fixType: true, effectiveness: true, notes: true,
      toolsUsed: true, sparePartsUsed: true, finalComponentId: true, finalSubcomponentId: true,
    },
    orderBy: { performedAt: 'desc' },
    take: 1,
  });

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

  const sol = solutions[0];
  if (!sol) { fail('No se encontró solución'); return; }

  pass(`diagnosis:      "${sol.diagnosis.substring(0, 60)}..."`);
  pass(`solution:       "${sol.solution.substring(0, 60)}..."`);
  pass(`outcome:        ${sol.outcome} | fixType: ${sol.fixType}`);
  pass(`actualMinutes:  ${sol.actualMinutes} min`);
  pass(`confirmedCause: "${sol.confirmedCause}"`);
  pass(`effectiveness:  ${sol.effectiveness}/5`);
  pass(`notes:          "${sol.notes}"`);
  pass(`toolsUsed:      ${JSON.stringify(sol.toolsUsed)}`);
  pass(`sparePartsUsed: ${JSON.stringify(sol.sparePartsUsed)}`);
  pass(`finalComponent: ${sol.finalComponent ? `"${sol.finalComponent.name}"` : 'null'}`);

  const fo2 = (verifyWO as any).failureOccurrences[0];
  pass(`Falla corregida: "${fo2.title}"`);
  pass(`originalReport guardado: ${fo2.originalReport ? 'SÍ ✅' : 'NO ❌'}`);
  pass(`correctedAt: ${fo2.correctedAt}`);

  console.log(`
${BOLD}══════════════════════════════════════════════════
  OT #190 CERRADA CON ÉXITO
  SolutionApplied ID: ${sa.id}
  Falla ID: ${FO_ID} (con corrección + snapshot original)
══════════════════════════════════════════════════${RESET}
  `);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
