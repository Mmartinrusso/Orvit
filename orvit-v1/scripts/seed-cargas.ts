import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Obtener el primer company existente
  const company = await prisma.company.findFirst();
  if (!company) {
    console.error('No hay companies en la BD');
    return;
  }

  console.log(`Usando companyId: ${company.id} (${company.name})`);

  // Verificar si ya hay camiones
  const existingTrucks = await prisma.truck.findMany({
    where: { companyId: company.id },
  });

  if (existingTrucks.length > 1) {
    console.log(`Ya existen ${existingTrucks.length} camiones`);
  } else {
    // Crear camiones de ejemplo
    console.log('Creando camiones de ejemplo...');

    const trucksData = [
      {
        name: 'Camión Semi-1',
        type: 'SEMI' as const,
        length: 14.0,
        maxWeight: 32,
        isOwn: true,
        companyId: company.id,
      },
      {
        name: 'Chasis Scania',
        type: 'CHASIS' as const,
        length: 8.5,
        maxWeight: 18,
        isOwn: true,
        companyId: company.id,
      },
      {
        name: 'Equipo Volvo',
        type: 'EQUIPO' as const,
        length: 12.0,
        maxWeight: 28,
        chasisLength: 6.5,
        acopladoLength: 5.5,
        chasisWeight: 14,
        acopladoWeight: 14,
        isOwn: true,
        companyId: company.id,
      },
      {
        name: 'Transporte García',
        type: 'SEMI' as const,
        length: 13.5,
        maxWeight: 30,
        isOwn: false,
        client: 'Transportes García S.A.',
        companyId: company.id,
      },
    ];

    for (const truck of trucksData) {
      try {
        await prisma.truck.create({ data: truck });
        console.log(`  ✓ Camión creado: ${truck.name}`);
      } catch (e: any) {
        if (e.code === 'P2002') {
          console.log(`  - Camión ya existe: ${truck.name}`);
        } else {
          console.error(`  ✗ Error creando ${truck.name}:`, e.message);
        }
      }
    }
  }

  // Obtener todos los camiones
  const trucks = await prisma.truck.findMany({
    where: { companyId: company.id },
  });

  console.log(`\nCamiones disponibles: ${trucks.length}`);

  // Verificar si ya hay cargas
  const existingLoads = await prisma.load.count({
    where: { companyId: company.id },
  });

  if (existingLoads > 0) {
    console.log(`Ya existen ${existingLoads} cargas`);
    return;
  }

  // Crear cargas de ejemplo
  console.log('\nCreando cargas de ejemplo...');

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  const loadsData = [
    {
      truck: trucks.find(t => t.type === 'SEMI') || trucks[0],
      date: today,
      description: 'Entrega zona norte',
      deliveryClient: 'Constructora Norte S.A.',
      deliveryAddress: 'Av. Industrial 1234, Zona Norte',
      items: [
        { productName: 'Vigueta 6.00m', length: 6.0, weight: 85, quantity: 40 },
        { productName: 'Vigueta 5.50m', length: 5.5, weight: 78, quantity: 30 },
        { productName: 'Vigueta 4.80m', length: 4.8, weight: 68, quantity: 50 },
      ],
    },
    {
      truck: trucks.find(t => t.type === 'EQUIPO') || trucks[0],
      date: yesterday,
      description: 'Obra centro comercial',
      deliveryClient: 'Grupo Constructor ABC',
      deliveryAddress: 'Centro Comercial Plaza, Local 45',
      items: [
        { productName: 'Vigueta 7.20m', length: 7.2, weight: 102, quantity: 20 },
        { productName: 'Vigueta 6.50m', length: 6.5, weight: 92, quantity: 25 },
        { productName: 'Vigueta 5.80m', length: 5.8, weight: 82, quantity: 35 },
      ],
    },
    {
      truck: trucks.find(t => t.type === 'CHASIS') || trucks[0],
      date: lastWeek,
      description: 'Proyecto residencial',
      deliveryClient: 'Inmobiliaria del Sur',
      deliveryAddress: 'Barrio Los Álamos, Mza 15',
      items: [
        { productName: 'Vigueta 4.50m', length: 4.5, weight: 64, quantity: 60 },
        { productName: 'Vigueta 4.00m', length: 4.0, weight: 57, quantity: 80 },
      ],
    },
    {
      truck: trucks.find(t => t.type === 'SEMI') || trucks[0],
      date: today,
      description: 'Corralón - Reposición stock',
      isCorralon: true,
      items: [
        { productName: 'Vigueta 6.80m', length: 6.8, weight: 96, quantity: 30 },
        { productName: 'Vigueta 5.20m', length: 5.2, weight: 74, quantity: 40 },
        { productName: 'Vigueta 4.20m', length: 4.2, weight: 60, quantity: 50 },
      ],
    },
    {
      truck: trucks.find(t => !t.isOwn) || trucks[0],
      date: yesterday,
      description: 'Flete tercerizado',
      deliveryClient: 'Constructora del Este',
      deliveryAddress: 'Parque Industrial Este, Nave 7',
      items: [
        { productName: 'Vigueta 8.00m', length: 8.0, weight: 113, quantity: 15 },
        { productName: 'Vigueta 7.50m', length: 7.5, weight: 106, quantity: 20 },
      ],
    },
  ];

  for (let i = 0; i < loadsData.length; i++) {
    const loadData = loadsData[i];
    try {
      const load = await prisma.load.create({
        data: {
          truckId: loadData.truck.id,
          companyId: company.id,
          date: loadData.date,
          description: loadData.description,
          deliveryClient: loadData.deliveryClient || null,
          deliveryAddress: loadData.deliveryAddress || null,
          isCorralon: loadData.isCorralon || false,
          items: {
            create: loadData.items.map((item, idx) => ({
              productId: `prod-${item.productName.replace(/\s/g, '-').toLowerCase()}`,
              productName: item.productName,
              length: item.length,
              weight: item.weight,
              quantity: item.quantity,
              position: idx,
            })),
          },
        },
        include: { items: true },
      });
      console.log(`  ✓ Carga #${load.id} creada: ${loadData.description} (${load.items.length} items)`);
    } catch (e: any) {
      console.error(`  ✗ Error creando carga:`, e.message);
    }
  }

  console.log('\n✓ Seed completado!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
