const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔄 Creando cliente de ejemplo...');

    // Obtener la primera empresa disponible
    const company = await prisma.company.findFirst({
      orderBy: { id: 'asc' }
    });

    if (!company) {
      console.error('❌ No se encontró ninguna empresa en la base de datos');
      return;
    }

    console.log(`📦 Usando empresa: ${company.name} (ID: ${company.id})`);

    // Generar ID único (similar a cuid)
    const cuid = () => {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 15);
      return `cl${timestamp}${random}`;
    };
    const clientId = cuid();

    // Usar SQL raw directamente ya que Prisma Client puede no estar actualizado
    console.log('📝 Creando cliente con SQL raw...');
    
    await prisma.$executeRaw`
      INSERT INTO "Client" (
        id, "legalName", name, email, phone, address, city, province, "postalCode",
        cuit, "taxCondition", "companyId", "isActive", "createdAt", "updatedAt"
      ) VALUES (
        ${clientId},
        ${'Ejemplo S.A.'},
        ${'Cliente Ejemplo'},
        ${'ejemplo@cliente.com'},
        ${'+54 11 1234-5678'},
        ${'Av. Corrientes 1234'},
        ${'CABA'},
        ${'Buenos Aires'},
        ${'C1000'},
        ${'30-12345678-9'},
        ${'responsable_inscripto'},
        ${company.id},
        true,
        NOW(),
        NOW()
      )
    `;

    const created = await prisma.$queryRaw`
      SELECT * FROM "Client" WHERE id = ${clientId}
    `;

    console.log('✅ Cliente creado:', created[0]);

    console.log('✅ Cliente de ejemplo creado correctamente');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();

