import { prisma } from '../../lib/prisma';

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true, name: true } });
  if (!company) throw new Error('No hay empresas');

  const user = await prisma.user.findFirst({
    where: { companies: { some: { companyId: company.id } } },
    select: { id: true, name: true }
  });
  const machine = await prisma.machine.findFirst({
    where: { companyId: company.id },
    select: { id: true, name: true }
  });
  const component = await prisma.component.findFirst({
    where: { machine: { companyId: company.id } },
    select: { id: true, name: true, machineId: true }
  });
  const tool = await prisma.tool.findFirst({
    where: { companyId: company.id },
    select: { id: true, name: true, stockQuantity: true }
  });

  console.log(JSON.stringify({ company, user, machine, component, tool }, null, 2));
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
