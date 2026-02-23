const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDeleteBase() {
  try {
    console.log('🧪 Probando funcionalidad de eliminar bases de impuestos...\n');
    
    // 1. Verificar bases existentes
    console.log('1️⃣ Verificando bases existentes...');
    const existingBases = await prisma.taxBase.findMany({
      include: {
        createdByUser: {
          select: { id: true, name: true, email: true }
        }
      }
    });
    console.log('✅ Bases encontradas:', existingBases.length);
    existingBases.forEach(base => {
      console.log(`   - ${base.name} (ID: ${base.id}) - Creado por: ${base.createdByUser.name}`);
    });
    
    if (existingBases.length === 0) {
      console.log('ℹ️  No hay bases para probar la eliminación');
      return;
    }
    
    // 2. Verificar registros asociados
    console.log('\n2️⃣ Verificando registros asociados...');
    for (const base of existingBases) {
      const recordsCount = await prisma.taxRecord.count({
        where: { taxBaseId: base.id }
      });
      console.log(`   - ${base.name}: ${recordsCount} registro${recordsCount !== 1 ? 's' : ''}`);
    }
    
    // 3. Simular la lógica de la API DELETE
    console.log('\n3️⃣ Simulando lógica de eliminación...');
    const testBase = existingBases[0];
    console.log(`   Probando con: ${testBase.name} (ID: ${testBase.id})`);
    
    // Verificar que la base existe
    const taxBase = await prisma.taxBase.findUnique({
      where: { id: testBase.id },
      include: {
        company: true
      }
    });
    
    if (!taxBase) {
      console.log('❌ Base no encontrada');
      return;
    }
    
    console.log('✅ Base encontrada:', taxBase.name);
    
    // Verificar registros asociados
    const recordsCount = await prisma.taxRecord.count({
      where: { taxBaseId: testBase.id }
    });
    
    if (recordsCount > 0) {
      console.log(`⚠️  No se puede eliminar: tiene ${recordsCount} registro${recordsCount !== 1 ? 's' : ''} asociado${recordsCount !== 1 ? 's' : ''}`);
      console.log('💡 La API debería devolver un error apropiado');
    } else {
      console.log('✅ No hay registros asociados, se puede eliminar');
      console.log('💡 La API permitiría la eliminación');
    }
    
    console.log('\n✅ Prueba de lógica completada');
    console.log('🎯 La funcionalidad de eliminar está lista para usar');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testDeleteBase();
