import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Find the template
  const template = await prisma.productionRoutineTemplate.findFirst({
    where: { code: 'PLANTA_VIGUETAS_' },
    select: { id: true, code: true, name: true, sectorId: true, companyId: true }
  });
  console.log('Template:', JSON.stringify(template, null, 2));

  if (!template) {
    console.log('Template not found!');
    return;
  }

  // Find sectors for this company that contain "Viguetas"
  const sectors = await prisma.sector.findMany({
    where: {
      companyId: template.companyId,
      name: { contains: 'Viguetas', mode: 'insensitive' }
    },
    select: { id: true, name: true }
  });
  console.log('Matching Sectors:', JSON.stringify(sectors, null, 2));

  // If we found a matching sector and template doesn't have one, update it
  if (sectors.length > 0 && !template.sectorId) {
    const targetSector = sectors[0];
    console.log(`Updating template to use sector: ${targetSector.name} (ID: ${targetSector.id})`);

    await prisma.productionRoutineTemplate.update({
      where: { id: template.id },
      data: { sectorId: targetSector.id }
    });
    console.log('Template updated successfully!');
  } else if (template.sectorId) {
    console.log('Template already has a sector assigned:', template.sectorId);
  } else {
    console.log('No matching sector found');
    // Show all sectors
    const allSectors = await prisma.sector.findMany({
      where: { companyId: template.companyId },
      select: { id: true, name: true }
    });
    console.log('All company sectors:', JSON.stringify(allSectors, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
