import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

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
      where: { id: payload.userId as number }
    });

    return user;
  } catch (error) {
    console.error('Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const contactId = parseInt(params.id);

    if (isNaN(contactId)) {
      return NextResponse.json(
        { error: 'ID de contacto inválido' },
        { status: 400 }
      );
    }

    console.log('🔍 [API] Obteniendo contacto:', contactId, 'para usuario:', user.id);

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

    // Obtener contacto específico (consulta simplificada)
    const contactResult = await prisma.$queryRaw`
      SELECT * FROM "Contact" 
      WHERE id = ${contactId} AND "userId" = ${user.id} AND "isActive" = true
    ` as any[];

    if (contactResult.length === 0) {
      return NextResponse.json(
        { error: 'Contacto no encontrado' },
        { status: 404 }
      );
    }

    const contact = contactResult[0];

    // Transformar para el frontend
    const transformedContact = {
      id: contact.id.toString(),
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      position: contact.position,
      notes: contact.notes,
      avatar: contact.avatar,
      category: contact.category,
      tags: (() => { if (!contact.tags) return []; if (typeof contact.tags !== 'string') return contact.tags; try { return JSON.parse(contact.tags); } catch { return []; } })(),
      isActive: contact.isActive,
      pendingReminders: 0, // Temporal: sin recordatorios por ahora
      totalInteractions: 0, // Temporal: sin interacciones por ahora
      createdAt: new Date(contact.createdAt).toISOString(),
      updatedAt: new Date(contact.updatedAt).toISOString()
    };

    console.log('✅ [API] Contacto encontrado:', contact.id);

    return NextResponse.json({
      success: true,
      contact: transformedContact
    });

  } catch (error) {
    console.error('❌ [API] Error obteniendo contacto:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const contactId = parseInt(params.id);

    if (isNaN(contactId)) {
      return NextResponse.json(
        { error: 'ID de contacto inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();
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
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      );
    }

    console.log('📝 [API] Actualizando contacto:', contactId, 'para usuario:', user.id);

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

    // Actualizar contacto usando SQL raw
    const updateResult = await prisma.$queryRaw`
      UPDATE "Contact" 
      SET 
        name = ${name},
        email = ${email || null},
        phone = ${phone || null},
        company = ${company || null},
        position = ${position || null},
        notes = ${notes || null},
        avatar = ${avatar || null},
        category = ${category || 'Personal'},
        tags = ${tags ? JSON.stringify(tags) : null}::jsonb,
        "updatedAt" = NOW()
      WHERE id = ${contactId} AND "userId" = ${user.id} AND "isActive" = true
      RETURNING *
    ` as any[];

    if (updateResult.length === 0) {
      return NextResponse.json(
        { error: 'Contacto no encontrado o no tienes permisos para editarlo' },
        { status: 404 }
      );
    }

    const updatedContact = updateResult[0];

    // Transformar para el frontend
    const transformedContact = {
      id: updatedContact.id.toString(),
      name: updatedContact.name,
      email: updatedContact.email,
      phone: updatedContact.phone,
      company: updatedContact.company,
      position: updatedContact.position,
      notes: updatedContact.notes,
      avatar: updatedContact.avatar,
      category: updatedContact.category,
      tags: (() => { if (!updatedContact.tags) return []; try { return JSON.parse(updatedContact.tags as string); } catch { return []; } })(),
      isActive: updatedContact.isActive,
      pendingReminders: 0, // Se puede actualizar después
      totalInteractions: 0, // Se puede actualizar después
      createdAt: new Date(updatedContact.createdAt).toISOString(),
      updatedAt: new Date(updatedContact.updatedAt).toISOString()
    };

    console.log('✅ [API] Contacto actualizado exitosamente:', contactId);

    return NextResponse.json({
      success: true,
      contact: transformedContact
    });

  } catch (error) {
    console.error('❌ [API] Error actualizando contacto:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const contactId = parseInt(params.id);

    if (isNaN(contactId)) {
      return NextResponse.json(
        { error: 'ID de contacto inválido' },
        { status: 400 }
      );
    }

    console.log('🗑️ [API] Eliminando contacto:', contactId, 'para usuario:', user.id);

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

    // Eliminar contacto (soft delete)
    const deleteResult = await prisma.$queryRaw`
      UPDATE "Contact" 
      SET 
        "isActive" = false,
        "updatedAt" = NOW()
      WHERE id = ${contactId} AND "userId" = ${user.id} AND "isActive" = true
      RETURNING id
    ` as any[];

    if (deleteResult.length === 0) {
      return NextResponse.json(
        { error: 'Contacto no encontrado o no tienes permisos para eliminarlo' },
        { status: 404 }
      );
    }

    console.log('✅ [API] Contacto eliminado exitosamente:', contactId);

    return NextResponse.json({
      success: true,
      message: 'Contacto eliminado exitosamente'
    });

  } catch (error) {
    console.error('❌ [API] Error eliminando contacto:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 