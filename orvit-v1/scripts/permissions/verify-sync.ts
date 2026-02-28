import { PrismaClient } from '@prisma/client';
import { PERMISSION_CATALOG } from '../../lib/permissions-catalog';

const prisma = new PrismaClient();

async function main() {
  const dbPerms = await prisma.permission.findMany({ select: { name: true }, orderBy: { name: 'asc' } });
  const catalogNames = new Set(Object.keys(PERMISSION_CATALOG));

  const extra = dbPerms.filter(p => !catalogNames.has(p.name));
  const missing = Array.from(catalogNames).filter(n => !dbPerms.some(p => p.name === n));

  console.log('BD:', dbPerms.length, '| Catalogo:', catalogNames.size);
  console.log('En BD pero no en catalogo:', extra.length);
  extra.forEach(p => console.log('  -', p.name));
  console.log('En catalogo pero no en BD:', missing.length);
  missing.forEach(n => console.log('  -', n));

  if (extra.length === 0 && missing.length === 0) {
    console.log('\n✅ BD y catalogo 100% sincronizados');
  }
}
main().finally(() => prisma.$disconnect());
