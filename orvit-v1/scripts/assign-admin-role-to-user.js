const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const USER_EMAIL = 'maartinrusso@gmail.com';
const ROLE_NAME = 'Administrador';

async function assignAdminRoleToUser() {
  try {
    console.log(`🚀 Asignando rol "${ROLE_NAME}" al usuario ${USER_EMAIL}...\n`);

    // 1. Buscar el usuario por email
    const user = await prisma.user.findUnique({
      where: { email: USER_EMAIL },
      include: {
        companies: {
          include: {
            company: true
          }
        },
        ownedCompanies: true
      }
    });

    if (!user) {
      console.log(`❌ No se encontró usuario con email: ${USER_EMAIL}`);
      return;
    }

    console.log(`✅ Usuario encontrado: ${user.name} (ID: ${user.id})`);

    // 2. Obtener todas las empresas del usuario (las que posee o las que es miembro)
    const companies = [];
    
    if (user.ownedCompanies && user.ownedCompanies.length > 0) {
      companies.push(...user.ownedCompanies);
    }
    
    if (user.companies && user.companies.length > 0) {
      companies.push(...user.companies.map(uc => uc.company));
    }

    if (companies.length === 0) {
      console.log(`⚠️  El usuario no está asociado a ninguna empresa`);
      return;
    }

    console.log(`📋 Empresas encontradas: ${companies.length}\n`);

    let rolesAssigned = 0;
    let rolesUpdated = 0;
    let rolesNotFound = 0;

    // 3. Para cada empresa, asignar el rol "Administrador"
    for (const company of companies) {
      console.log(`🏢 Procesando empresa: ${company.name} (ID: ${company.id})`);

      try {
        // Buscar el rol "Administrador" en esta empresa
        const adminRole = await prisma.role.findFirst({
          where: {
            name: ROLE_NAME,
            companyId: company.id
          }
        });

        if (!adminRole) {
          console.log(`  ⚠️  Rol "${ROLE_NAME}" no encontrado en esta empresa`);
          rolesNotFound++;
          continue;
        }

        console.log(`  ✅ Rol "${ROLE_NAME}" encontrado (ID: ${adminRole.id})`);

        // Buscar o crear la relación UserOnCompany
        const existingRelation = await prisma.userOnCompany.findUnique({
          where: {
            userId_companyId: {
              userId: user.id,
              companyId: company.id
            }
          }
        });

        if (existingRelation) {
          // Actualizar el rol existente
          await prisma.userOnCompany.update({
            where: {
              userId_companyId: {
                userId: user.id,
                companyId: company.id
              }
            },
            data: {
              roleId: adminRole.id,
              isActive: true
            }
          });
          console.log(`  ✅ Rol "${ROLE_NAME}" asignado (actualizado)`);
          rolesUpdated++;
        } else {
          // Crear nueva relación
          await prisma.userOnCompany.create({
            data: {
              userId: user.id,
              companyId: company.id,
              roleId: adminRole.id,
              isActive: true
            }
          });
          console.log(`  ✅ Rol "${ROLE_NAME}" asignado (nueva relación creada)`);
          rolesAssigned++;
        }

      } catch (error) {
        console.error(`  ❌ Error procesando empresa ${company.name}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMEN FINAL:');
    console.log('='.repeat(50));
    console.log(`✅ Roles asignados (nuevos): ${rolesAssigned}`);
    console.log(`🔄 Roles actualizados: ${rolesUpdated}`);
    console.log(`⚠️  Empresas sin rol "${ROLE_NAME}": ${rolesNotFound}`);
    console.log(`📋 Total de empresas procesadas: ${companies.length}`);

    if (rolesAssigned > 0 || rolesUpdated > 0) {
      console.log('\n🎉 ¡Proceso completado exitosamente!');
    } else {
      console.log('\nℹ️  El usuario ya tenía el rol asignado en todas sus empresas.');
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    await prisma.$disconnect();
  }
}

assignAdminRoleToUser();

