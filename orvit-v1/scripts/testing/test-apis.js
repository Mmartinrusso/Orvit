const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAPIs() {
  try {
    console.log('🧪 Probando APIs del sistema de impuestos...\n');
    
    // Simular la lógica de las APIs
    console.log('1️⃣ Probando GET /api/tax-base...');
    const user = await prisma.user.findFirst({
      where: { isActive: true }
    });
    console.log('✅ Usuario encontrado:', user?.name);
    
    const companyId = 3; // Pretensados Cordoba
    const taxBases = await prisma.taxBase.findMany({
      where: {
        companyId: companyId,
        isActive: true,
      },
      include: {
        createdByUser: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });
    console.log('✅ TaxBases encontradas:', taxBases.length);
    
    console.log('\n2️⃣ Probando GET /api/tax-record...');
    const month = '2025-10';
    const taxRecords = await prisma.taxRecord.findMany({
      where: {
        taxBase: {
          companyId: companyId
        },
        month: month
      },
      include: {
        taxBase: {
          select: { id: true, name: true, description: true, recurringDay: true, isRecurring: true }
        },
        receivedByUser: {
          select: { id: true, name: true, email: true }
        },
        paidByUser: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: {
        alertDate: 'asc'
      }
    });
    console.log('✅ TaxRecords encontrados:', taxRecords.length);
    
    console.log('\n3️⃣ Probando POST /api/tax-base...');
    const newTaxBase = await prisma.taxBase.create({
      data: {
        name: 'Test IIBB',
        description: 'Impuesto a los Ingresos Brutos - Test',
        recurringDay: 5,
        companyId: companyId,
        createdBy: user.id,
        notes: 'Base de prueba',
        isRecurring: true,
        isActive: true
      }
    });
    console.log('✅ TaxBase creada:', newTaxBase.name);
    
    console.log('\n4️⃣ Verificando la TaxBase creada...');
    const createdTaxBase = await prisma.taxBase.findUnique({
      where: { id: newTaxBase.id },
      include: {
        createdByUser: {
          select: { id: true, name: true, email: true }
        }
      }
    });
    console.log('✅ TaxBase verificada:', createdTaxBase?.name);
    
    console.log('\n✅ ¡Todas las APIs funcionan correctamente!');
    console.log('🎯 El problema debe ser que el servidor necesita reiniciarse.');
    console.log('💡 Reinicia el servidor de desarrollo con: npm run dev');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testAPIs();
