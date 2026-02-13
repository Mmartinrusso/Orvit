const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Creando usuario de prueba del portal...\n');

  // Buscar empresa
  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) {
    console.error('❌ No se encontró ninguna empresa activa');
    return;
  }
  console.log('✅ Empresa:', company.name, '(ID:', company.id + ')');

  // Buscar cliente
  let client = await prisma.client.findFirst({
    where: { companyId: company.id },
  });

  if (!client) {
    console.error('❌ No se encontró ningún cliente');
    return;
  }
  console.log('✅ Cliente:', client.legalName);

  // Buscar o crear contacto
  let contact = await prisma.clientContact.findFirst({
    where: { clientId: client.id },
  });

  if (!contact) {
    contact = await prisma.clientContact.create({
      data: {
        clientId: client.id,
        companyId: company.id,
        firstName: 'Usuario',
        lastName: 'Portal',
        email: 'portal@test.com',
        phone: '1155550000',
        position: 'Compras',
        isPrimary: true,
        isActive: true,
      },
    });
    console.log('✅ Contacto creado:', contact.firstName, contact.lastName);
  } else {
    console.log('✅ Contacto existente:', contact.firstName, contact.lastName);
  }

  // Verificar usuario existente
  const existingUser = await prisma.clientPortalUser.findUnique({
    where: { contactId: contact.id },
  });

  if (existingUser) {
    console.log('\n⚠️ Ya existe usuario del portal');
    console.log('   Email:', existingUser.email);
    console.log('   Verificado:', existingUser.isVerified ? 'Sí' : 'No');

    if (!existingUser.isVerified) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await prisma.clientPortalInvite.updateMany({
        where: { portalUserId: existingUser.id, usedAt: null },
        data: { expiresAt: new Date(0) },
      });

      await prisma.clientPortalInvite.create({
        data: {
          portalUserId: existingUser.id,
          companyId: company.id,
          token,
          expiresAt,
                    createdBy: 1,
        },
      });

      console.log('\n📧 Nueva invitación:');
      console.log('   URL: http://localhost:3000/portal/activate/' + token);
    }
    return;
  }

  // Crear usuario del portal
  const portalUser = await prisma.clientPortalUser.create({
    data: {
      companyId: company.id,
      clientId: client.id,
      contactId: contact.id,
      email: contact.email || 'portal@test.com',
      passwordHash: '',
      isActive: true,
      isVerified: false,
      canViewPrices: true,
      canViewQuotes: true,
      canAcceptQuotes: true,
      canCreateOrders: true,
      canViewHistory: true,
      canViewDocuments: true,
    },
  });

  console.log('✅ Usuario portal creado:', portalUser.email);

  // Crear invitación
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.clientPortalInvite.create({
    data: {
      portalUserId: portalUser.id,
      companyId: company.id,
      token,
      expiresAt,
            createdBy: 1,
    },
  });

  console.log('\n' + '='.repeat(60));
  console.log('\n📧 DATOS DEL USUARIO DE PRUEBA:');
  console.log('   Email:', portalUser.email);
  console.log('   Cliente:', client.legalName);
  console.log('\n🔗 URL DE ACTIVACIÓN:');
  console.log('   http://localhost:3000/portal/activate/' + token);
  console.log('\n' + '='.repeat(60));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
