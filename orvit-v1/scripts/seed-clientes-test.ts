import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CLIENTES_TEST = [
  {
    legalName: 'ACME Corporation S.A.',
    name: 'ACME Corp',
    email: 'contacto@acmecorp.com',
    phone: '+54 11 4567-8901',
    cuit: '30-71234567-8',
    taxCondition: 'responsable_inscripto',
    creditLimit: 500000,
    currentBalance: 125000,
    isActive: true,
    isBlocked: false,
    address: 'Av. Corrientes 1234',
    city: 'Buenos Aires',
    province: 'Buenos Aires',
    postalCode: 'C1043',
    paymentTerms: 30,
    tipoCondicionVenta: 'FORMAL',
  },
  {
    legalName: 'Distribuidora El Roble S.R.L.',
    name: 'El Roble',
    email: 'ventas@elroble.com.ar',
    phone: '+54 341 432-1098',
    cuit: '30-65432109-4',
    taxCondition: 'responsable_inscripto',
    creditLimit: 300000,
    currentBalance: 0,
    isActive: true,
    isBlocked: false,
    address: 'San Martín 456',
    city: 'Rosario',
    province: 'Santa Fe',
    postalCode: 'S2000',
    paymentTerms: 60,
    tipoCondicionVenta: 'FORMAL',
  },
  {
    legalName: 'Supermercado La Esquina',
    name: 'La Esquina',
    email: 'compras@laesquina.com',
    phone: '+54 261 423-5678',
    cuit: '20-29876543-5',
    taxCondition: 'monotributo',
    creditLimit: 100000,
    currentBalance: 45000,
    isActive: true,
    isBlocked: false,
    address: 'Belgrano 789',
    city: 'Mendoza',
    province: 'Mendoza',
    postalCode: 'M5500',
    paymentTerms: 15,
    tipoCondicionVenta: 'FORMAL',
  },
  {
    legalName: 'Mayorista del Norte S.A.',
    name: 'Mayorista Norte',
    email: 'info@mayoristandelnorte.com',
    phone: '+54 381 456-7890',
    cuit: '30-78901234-2',
    taxCondition: 'responsable_inscripto',
    creditLimit: 750000,
    currentBalance: 250000,
    isActive: true,
    isBlocked: false,
    address: 'Av. Alem 2345',
    city: 'Tucumán',
    province: 'Tucumán',
    postalCode: 'T4000',
    paymentTerms: 45,
    tipoCondicionVenta: 'FORMAL',
  },
  {
    legalName: 'Comercial San Juan S.H.',
    name: 'San Juan',
    email: 'ventas@comercialsanjuan.com',
    phone: '+54 264 421-3456',
    cuit: '30-54321098-7',
    taxCondition: 'responsable_inscripto',
    creditLimit: 200000,
    currentBalance: 80000,
    isActive: true,
    isBlocked: false,
    address: 'Rivadavia 567',
    city: 'San Juan',
    province: 'San Juan',
    postalCode: 'J5400',
    paymentTerms: 30,
    tipoCondicionVenta: 'FORMAL',
  },
  {
    legalName: 'Gonzalez, Maria Laura',
    name: 'Maria Gonzalez',
    email: 'mariagonzalez@email.com',
    phone: '+54 11 5432-1098',
    cuit: '27-35678901-4',
    taxCondition: 'consumidor_final',
    creditLimit: null,
    currentBalance: 0,
    isActive: true,
    isBlocked: false,
    address: 'Mitre 123',
    city: 'La Plata',
    province: 'Buenos Aires',
    postalCode: 'B1900',
    paymentTerms: null,
    tipoCondicionVenta: 'FORMAL',
  },
  {
    legalName: 'Kiosco Central',
    name: 'Central',
    email: 'kioscocentral@hotmail.com',
    phone: '+54 351 432-7654',
    cuit: '20-23456789-1',
    taxCondition: 'monotributo',
    creditLimit: 50000,
    currentBalance: 15000,
    isActive: true,
    isBlocked: false,
    address: 'Dean Funes 890',
    city: 'Córdoba',
    province: 'Córdoba',
    postalCode: 'X5000',
    paymentTerms: 7,
    tipoCondicionVenta: 'FORMAL',
  },
  {
    legalName: 'Almacén Don Pedro',
    name: 'Don Pedro',
    email: 'donpedro@gmail.com',
    phone: '+54 223 478-9012',
    cuit: '20-18765432-8',
    taxCondition: 'monotributo',
    creditLimit: 80000,
    currentBalance: 0,
    isActive: true,
    isBlocked: false,
    address: 'Colón 345',
    city: 'Mar del Plata',
    province: 'Buenos Aires',
    postalCode: 'B7600',
    paymentTerms: 15,
    tipoCondicionVenta: 'FORMAL',
  },
  {
    legalName: 'Distribuidora Patagonia S.A.',
    name: 'Patagonia',
    email: 'ventas@distpatagonia.com',
    phone: '+54 2920 45-6789',
    cuit: '30-89012345-6',
    taxCondition: 'responsable_inscripto',
    creditLimit: 600000,
    currentBalance: 180000,
    isActive: true,
    isBlocked: false,
    address: 'San Martín 1234',
    city: 'Río Gallegos',
    province: 'Santa Cruz',
    postalCode: 'Z9400',
    paymentTerms: 60,
    tipoCondicionVenta: 'FORMAL',
  },
  {
    legalName: 'Maxikiosco La Amistad',
    name: 'La Amistad',
    email: 'laamistad@yahoo.com',
    phone: '+54 376 443-2109',
    cuit: '20-31234567-2',
    taxCondition: 'monotributo',
    creditLimit: 40000,
    currentBalance: 12000,
    isActive: true,
    isBlocked: false,
    address: 'Junín 678',
    city: 'Posadas',
    province: 'Misiones',
    postalCode: 'N3300',
    paymentTerms: 7,
    tipoCondicionVenta: 'FORMAL',
  },
  {
    legalName: 'Supermercado Beta S.A.',
    name: 'Beta',
    email: 'compras@superbeta.com',
    phone: '+54 11 4890-1234',
    cuit: '30-90123456-8',
    taxCondition: 'responsable_inscripto',
    creditLimit: 800000,
    currentBalance: 520000,
    isActive: true,
    isBlocked: true,
    blockedReason: 'Límite de crédito excedido',
    address: 'Av. Libertador 5678',
    city: 'Buenos Aires',
    province: 'Buenos Aires',
    postalCode: 'C1426',
    paymentTerms: 30,
    tipoCondicionVenta: 'FORMAL',
  },
  {
    legalName: 'Ferretería Industrial SA',
    name: 'Ferretería Industrial',
    email: 'ventas@ferreteriaind.com',
    phone: '+54 343 420-9876',
    cuit: '30-45678901-3',
    taxCondition: 'responsable_inscripto',
    creditLimit: 450000,
    currentBalance: 0,
    isActive: true,
    isBlocked: false,
    address: 'Urquiza 234',
    city: 'Paraná',
    province: 'Entre Ríos',
    postalCode: 'E3100',
    paymentTerms: 45,
    tipoCondicionVenta: 'FORMAL',
  },
];

async function main() {
  console.log('🌱 Seeding clientes de prueba...');

  // Get first company
  const company = await prisma.company.findFirst();
  if (!company) {
    console.error('❌ No se encontró ninguna empresa. Crea una empresa primero.');
    return;
  }

  console.log(`✅ Usando empresa: ${company.name} (ID: ${company.id})`);

  let created = 0;
  let skipped = 0;

  for (const clienteData of CLIENTES_TEST) {
    try {
      // Check if client already exists
      const existing = await prisma.client.findFirst({
        where: {
          companyId: company.id,
          cuit: clienteData.cuit,
        },
      });

      if (existing) {
        console.log(`⏭️  Cliente ya existe: ${clienteData.legalName}`);
        skipped++;
        continue;
      }

      // Create client
      const cliente = await prisma.client.create({
        data: {
          ...clienteData,
          companyId: company.id,
        },
      });

      console.log(`✅ Cliente creado: ${cliente.legalName}`);
      created++;
    } catch (error) {
      console.error(`❌ Error creando ${clienteData.legalName}:`, error);
    }
  }

  console.log(`\n📊 Resumen:`);
  console.log(`   ✅ Creados: ${created}`);
  console.log(`   ⏭️  Omitidos: ${skipped}`);
  console.log(`   📝 Total: ${CLIENTES_TEST.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
