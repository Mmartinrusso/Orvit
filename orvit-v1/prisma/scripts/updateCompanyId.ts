import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Iniciando actualización de companyId para todos los documentos...');
  
  try {
    // Primero, verificar cuántos documentos hay
    const totalDocuments = await prisma.document.count();
    console.log(`📊 Total de documentos en la base de datos: ${totalDocuments}`);
    
    // Verificar cuántos ya tienen companyId = 3
    const documentsWithCompany3 = await prisma.document.count({
      where: { companyId: 3 }
    });
    console.log(`📊 Documentos que ya tienen companyId = 3: ${documentsWithCompany3}`);
    
    // Actualizar todos los documentos para que tengan companyId = 3
    const result = await prisma.document.updateMany({
      data: {
        companyId: 3,
      },
    });
    
    console.log(`✅ Se actualizaron ${result.count} documentos a companyId = 3.`);
    
    // Verificar el resultado final
    const finalCount = await prisma.document.count({
      where: { companyId: 3 }
    });
    console.log(`📊 Documentos con companyId = 3 después de la actualización: ${finalCount}`);
    
  } catch (error) {
    console.error('❌ Error al actualizar documentos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
