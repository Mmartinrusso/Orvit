const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔄 Creando cliente de ejemplo en el backend...');

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

    // Verificar si ya existe un cliente con ese email
    const existing = await prisma.$queryRaw`
      SELECT id FROM "Client" 
      WHERE email = ${'ejemplo@cliente.com'} AND "companyId" = ${company.id}
      LIMIT 1
    `;

    if (existing && existing.length > 0) {
      console.log('⚠️  Ya existe un cliente con ese email. Eliminando el anterior...');
      await prisma.$executeRaw`
        DELETE FROM "Client" WHERE email = ${'ejemplo@cliente.com'} AND "companyId" = ${company.id}
      `;
    }

    // Crear cliente con todos los campos requeridos
    console.log('📝 Creando cliente con SQL raw...');
    
    await prisma.$executeRaw`
      INSERT INTO "Client" (
        id, "legalName", name, email, phone, address, city, province, "postalCode",
        cuit, "taxCondition", "saleCondition", "paymentTerms", "creditLimit",
        "companyId", "isActive", "createdAt", "updatedAt"
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
        ${'cuenta_corriente'},
        ${30},
        ${100000},
        ${company.id},
        true,
        NOW(),
        NOW()
      )
    `;

    const created = await prisma.$queryRaw`
      SELECT * FROM "Client" WHERE id = ${clientId}
    `;

    console.log('✅ Cliente creado en el backend:', created[0]);
    console.log('\n📋 Detalles del cliente:');
    console.log(`   - ID: ${created[0].id}`);
    console.log(`   - Razón Social: ${created[0].legalName}`);
    console.log(`   - Nombre: ${created[0].name}`);
    console.log(`   - Email: ${created[0].email}`);
    console.log(`   - Condición de Venta: ${created[0].saleCondition}`);
    console.log(`   - Límite de Crédito: $${created[0].creditLimit || 0}`);
    console.log(`   - Empresa: ${company.name}`);
    console.log('\n✅ Cliente de ejemplo creado correctamente y visible en la interfaz');
    console.log('   Puedes verlo en: /administracion/ventas/clientes');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();

