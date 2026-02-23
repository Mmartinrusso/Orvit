/**
 * Script para crear un usuario de prueba del portal
 *
 * Ejecutar: npx ts-node scripts/create-portal-test-user.ts
 */

import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Creando usuario de prueba del portal...\n');

  // Buscar una empresa y un cliente existentes
  const company = await prisma.company.findFirst({
    where: { isActive: true },
  });

  if (!company) {
    console.error('❌ No se encontró ninguna empresa activa');
    return;
  }

  console.log(`✅ Empresa: ${company.name} (ID: ${company.id})`);

  let client = await prisma.client.findFirst({
    where: { companyId: company.id },
    include: { contacts: true },
  });

  if (!client) {
    // Crear un cliente de prueba
    client = await prisma.client.create({
      data: {
        companyId: company.id,
        legalName: 'Cliente de Prueba Portal',
        name: 'Cliente Prueba',
        documentType: 'CUIT',
        documentNumber: '20-12345678-9',
        email: 'cliente@prueba.com',
        phone: '1155550000',
        address: 'Av. Prueba 123',
        city: 'Buenos Aires',
        state: 'CABA',
        country: 'Argentina',
        isActive: true,
      },
      include: { contacts: true },
    });
    console.log(`✅ Cliente creado: ${client.legalName}`);
  } else {
    console.log(`✅ Cliente existente: ${client.legalName}`);
  }

  // Verificar si ya existe un contacto
  let contact = client.contacts?.[0];

  if (!contact) {
    // Crear contacto
    contact = await prisma.clientContact.create({
      data: {
        clientId: client.id,
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@prueba.com',
        phone: '1155551111',
        position: 'Compras',
        isPrimary: true,
        isActive: true,
      },
    });
    console.log(`✅ Contacto creado: ${contact.firstName} ${contact.lastName}`);
  } else {
    console.log(`✅ Contacto existente: ${contact.firstName} ${contact.lastName}`);
  }

  // Verificar si ya existe un usuario del portal para este contacto
  const existingUser = await prisma.clientPortalUser.findUnique({
    where: { contactId: contact.id },
  });

  if (existingUser) {
    console.log(`\n⚠️  Ya existe un usuario del portal para este contacto`);
    console.log(`   Email: ${existingUser.email}`);
    console.log(`   Verificado: ${existingUser.isVerified ? 'Sí' : 'No'}`);

    // Si no está verificado, crear nueva invitación
    if (!existingUser.isVerified) {
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Invalidar invitaciones anteriores
      await prisma.clientPortalInvite.updateMany({
        where: { portalUserId: existingUser.id, usedAt: null },
        data: { expiresAt: new Date(0) },
      });

      // Crear nueva invitación
      await prisma.clientPortalInvite.create({
        data: {
          portalUserId: existingUser.id,
          companyId: company.id,
          token,
          expiresAt,
        },
      });

      console.log(`\n📧 Nueva invitación creada:`);
      console.log(`   URL: http://localhost:3000/portal/activate/${token}`);
      console.log(`   Expira: ${expiresAt.toLocaleString()}`);
    }

    return;
  }

  // Crear usuario del portal
  const portalUser = await prisma.clientPortalUser.create({
    data: {
      companyId: company.id,
      clientId: client.id,
      contactId: contact.id,
      email: contact.email || 'portal@prueba.com',
      passwordHash: '', // Se establecerá en la activación
      isActive: true,
      isVerified: false,
      // Permisos
      canViewPrices: true,
      canViewQuotes: true,
      canAcceptQuotes: true,
      canCreateOrders: true,
      canViewHistory: true,
      canViewDocuments: true,
    },
  });

  console.log(`✅ Usuario del portal creado: ${portalUser.email}`);

  // Crear invitación
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.clientPortalInvite.create({
    data: {
      portalUserId: portalUser.id,
      companyId: company.id,
      token,
      expiresAt,
    },
  });

  console.log(`\n✅ Invitación creada`);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`\n📧 DATOS DEL USUARIO DE PRUEBA:`);
  console.log(`   Email: ${portalUser.email}`);
  console.log(`   Cliente: ${client.legalName}`);
  console.log(`   Empresa: ${company.name}`);
  console.log(`\n🔗 URL DE ACTIVACIÓN:`);
  console.log(`   http://localhost:3000/portal/activate/${token}`);
  console.log(`\n⏰ Expira: ${expiresAt.toLocaleString()}`);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`\nInstrucciones:`);
  console.log(`1. Abrir la URL de activación en el navegador`);
  console.log(`2. Crear una contraseña (mín 8 caracteres, 1 mayúscula, 1 minúscula, 1 número)`);
  console.log(`3. Iniciar sesión en http://localhost:3000/portal/login`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
