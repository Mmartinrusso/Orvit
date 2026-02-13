import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deleteS3File } from '@/lib/s3-utils';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { JWT_SECRET } from '@/lib/auth';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Función para validar JWT desde cookies
async function validateTokenFromCookie() {
  const cookieStore = cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return payload;
  } catch {
    return null;
  }
}

// GET /api/documents/[id] - Obtener un documento por ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await validateTokenFromCookie();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const documentId = parseInt(params.id);
    if (isNaN(documentId)) {
      return NextResponse.json({ error: 'ID de documento inválido' }, { status: 400 });
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    return NextResponse.json(document);
  } catch (error) {
    console.error('Error al obtener el documento:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PATCH /api/documents/[id] - Actualizar un documento (folder, name, etc.)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await validateTokenFromCookie();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const documentId = parseInt(params.id);
    if (isNaN(documentId)) {
      return NextResponse.json({ error: 'ID de documento inválido' }, { status: 400 });
    }

    const body = await request.json();
    const { folder, name } = body;

    // Verificar que el documento existe
    const existingDoc = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!existingDoc) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    // Construir objeto de actualización solo con campos proporcionados
    const updateData: any = {};
    if (folder !== undefined) updateData.folder = folder || null;
    if (name !== undefined) updateData.name = name;

    const updatedDoc = await prisma.document.update({
      where: { id: documentId },
      data: updateData,
    });

    return NextResponse.json(updatedDoc);
  } catch (error) {
    console.error('Error al actualizar el documento:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE /api/documents/[id] - Eliminar un documento
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await validateTokenFromCookie();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = params;

  try {
    const documentId = parseInt(id);
    if (isNaN(documentId)) {
      return NextResponse.json({ error: 'ID de documento inválido' }, { status: 400 });
    }

    // 1. Buscar el documento en la BD
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    // 2. Eliminar el registro de la BD primero (rollback posible si falla)
    await prisma.document.delete({
      where: { id: documentId },
    });

    // 3. Si tiene una URL de S3, eliminar el archivo (fire-and-forget, DB ya está limpia)
    if (document.url) {
      try {
        await deleteS3File(document.url);
      } catch (s3Error) {
        console.error('Error eliminando archivo de S3 (registro ya eliminado de BD):', s3Error);
      }
    }

    return NextResponse.json({ message: 'Documento eliminado exitosamente' }, { status: 200 });
  } catch (error) {
    console.error('Error al eliminar el documento:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
} 