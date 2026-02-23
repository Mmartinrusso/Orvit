import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const template = await prisma.productionRoutineTemplate.findFirst({
    where: { code: 'PLANTA_VIGUETAS_' },
    select: { items: true }
  });

  const itemsStr = JSON.stringify(template?.items || {});

  // Buscar el bloque EMPLOYEE_SELECT
  const empSelectMatch = itemsStr.match(/"type"\s*:\s*"EMPLOYEE_SELECT"[^}]+}/);
  console.log('EMPLOYEE_SELECT match:', empSelectMatch ? empSelectMatch[0] : 'No encontrado');

  // Buscar employeeSelectConfig
  console.log('\n--- Flags ---');
  console.log('attendanceTracking:', itemsStr.includes('"attendanceTracking"'));
  console.log('allowSectorTransfer:', itemsStr.includes('"allowSectorTransfer"'));
  console.log('workSectorAssignment:', itemsStr.includes('"workSectorAssignment"'));
  console.log('taskAssignment:', itemsStr.includes('"taskAssignment"'));

  // Mostrar substring alrededor de EMPLOYEE_SELECT
  const idx = itemsStr.indexOf('EMPLOYEE_SELECT');
  if (idx > -1) {
    console.log('\n--- Contexto EMPLOYEE_SELECT ---');
    console.log(itemsStr.substring(Math.max(0, idx - 100), idx + 500));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
