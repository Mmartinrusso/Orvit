import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret
import { validateRequest } from '@/lib/validations/helpers';
import { CreateContactSchema } from '@/lib/validations/contacts';

export const dynamic = 'force-dynamic';


const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper function para obtener usuario desde JWT
async function getUserFromToken(request: NextRequest) {
  try {
    const token = cookies().get('token')?.value;
    
    if (!token) {
      console.log('❌ No hay token JWT');
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: {
            company: true
          }
        },
        ownedCompanies: true
      }
    });

    return user;
  } catch (error) {
    console.error('Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const userId = user.id;
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    console.log('🔍 [API] Obteniendo contactos para usuario:', userId);

    let whereClause: any = {
      userId: userId,
      isActive: true
    };

    if (category && category !== 'all') {
      whereClause.category = category;
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { position: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Verificar si la tabla Contact existe
    const contactTableExists = await prisma.$queryRaw`
      SELECT COUNT(*) FROM information_schema.tables 
      WHERE table_name = 'Contact'
    ` as any[];

    if (!contactTableExists[0] || contactTableExists[0].count == 0) {
      console.log('📝 Tabla Contact no existe, devolviendo array vacío');
      return NextResponse.json({
        success: true,
        contacts: [],
        count: 0
      });
    }

    // Consulta parametrizada para evitar SQL injection
    const params: any[] = [userId];
    let paramIndex = 2;
    let sqlWhere = `WHERE "userId" = $1 AND "isActive" = true`;

    if (category && category !== 'all') {
      sqlWhere += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (search) {
      const searchPattern = `%${search}%`;
      sqlWhere += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR company ILIKE $${paramIndex} OR position ILIKE $${paramIndex})`;
      params.push(searchPattern);
      paramIndex++;
    }

    // Consulta simplificada sin JOINs complejos
    const contacts = await prisma.$queryRawUnsafe(`
      SELECT * FROM "Contact"
      ${sqlWhere}
      ORDER BY name ASC
    `, ...params) as any[];

    // Transformar datos para el frontend
    const transformedContacts = contacts.map((contact) => ({
      id: contact.id.toString(),
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      position: contact.position,
      notes: contact.notes,
      avatar: contact.avatar,
      category: contact.category,
      tags: contact.tags ? (typeof contact.tags === 'string' ? JSON.parse(contact.tags) : contact.tags) : [],
      isActive: contact.isActive,
      pendingReminders: 0, // Temporal: sin recordatorios por ahora
      totalInteractions: 0, // Temporal: sin interacciones por ahora
      createdAt: contact.createdAt ? new Date(contact.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: contact.updatedAt ? new Date(contact.updatedAt).toISOString() : new Date().toISOString()
    }));

    console.log('✅ [API] Contactos encontrados:', transformedContacts.length);

    return NextResponse.json({
      success: true,
      contacts: transformedContacts,
      count: transformedContacts.length
    });

  } catch (error) {
    console.error('❌ [API] Error obteniendo contactos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const userId = user.id;
    const body = await request.json();

    const validation = validateRequest(CreateContactSchema, body);
    if (!validation.success) {
      return validation.response;
    }

    const {
      name,
      email,
      phone,
      company,
      position,
      notes,
      avatar,
      category,
      tags
    } = validation.data;

    console.log('📝 [API] Creando contacto para usuario:', userId);

    // Verificar si la tabla Contact existe
    const contactTableExists = await prisma.$queryRaw`
      SELECT COUNT(*) FROM information_schema.tables 
      WHERE table_name = 'Contact'
    ` as any[];

    if (!contactTableExists[0] || contactTableExists[0].count == 0) {
      return NextResponse.json(
        { error: 'Sistema de contactos no configurado' },
        { status: 503 }
      );
    }

    // Crear contacto usando SQL raw
    const newContactResult = await prisma.$queryRaw`
      INSERT INTO "Contact" (
        name, email, phone, company, position, notes, avatar, category, tags, "userId", "isActive", "createdAt", "updatedAt"
      )
      VALUES (
        ${name}, 
        ${email || null}, 
        ${phone || null}, 
        ${company || null}, 
        ${position || null}, 
        ${notes || null}, 
        ${avatar || null}, 
        ${category || 'Personal'}, 
        ${tags ? JSON.stringify(tags) : null}::jsonb, 
        ${userId}, 
        true, 
        NOW(), 
        NOW()
      )
      RETURNING *
    ` as any[];

    const newContact = newContactResult[0];

    // Transformar para el frontend
    const transformedContact = {
      id: newContact.id.toString(),
      name: newContact.name,
      email: newContact.email,
      phone: newContact.phone,
      company: newContact.company,
      position: newContact.position,
      notes: newContact.notes,
      avatar: newContact.avatar,
      category: newContact.category,
      tags: newContact.tags ? (typeof newContact.tags === 'string' ? JSON.parse(newContact.tags) : newContact.tags) : [],
      isActive: newContact.isActive,
      pendingReminders: 0, // Nuevo contacto, sin recordatorios
      totalInteractions: 0, // Nuevo contacto, sin interacciones
      createdAt: new Date(newContact.createdAt).toISOString(),
      updatedAt: new Date(newContact.updatedAt).toISOString()
    };

    console.log('✅ [API] Contacto creado exitosamente:', newContact.id);

    return NextResponse.json(transformedContact, { status: 201 });

  } catch (error) {
    console.error('❌ [API] Error creando contacto:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 