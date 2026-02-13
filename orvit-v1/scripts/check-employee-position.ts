import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Buscar el empleado Zurita Jorge Daniel
  const employee = await prisma.employee.findFirst({
    where: { name: { contains: 'Zurita', mode: 'insensitive' } },
    include: {
      workSector: {
        include: {
          sourceSector: true
        }
      }
    }
  });

  console.log('Empleado:', JSON.stringify(employee, null, 2));

  // Ver todos los WorkSectors para entender la estructura
  const workSectors = await prisma.workSector.findMany({
    where: { company_id: 3 },
    include: { sourceSector: true }
  });
  console.log('\n--- Todos los WorkSectors ---');
  workSectors.forEach(ws => {
    console.log(`ID: ${ws.id}, Nombre: "${ws.name}", Sector: ${ws.sourceSector?.name || 'N/A'}`);
  });

  // ¿Hay alguna tabla de "puestos" o "positions" separada?
  // Buscar en el schema
  const tables = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND (table_name LIKE '%position%' OR table_name LIKE '%puesto%' OR table_name LIKE '%role%' OR table_name LIKE '%job%')
  `;
  console.log('\n--- Tablas relacionadas a puestos ---');
  console.log(tables);
}

main().catch(console.error).finally(() => prisma.$disconnect());
