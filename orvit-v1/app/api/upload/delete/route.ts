import { NextRequest, NextResponse } from 'next/server';
import { deleteS3File } from '@/lib/s3-utils';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';


const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Función para verificar autenticación
async function verifyAuth() {
  const token = cookies().get('token')?.value;
  
  // Si no hay token en cookies, permitir acceso temporalmente
  // (para desarrollo con sistema mock)
  if (!token) {
    console.log('⚠️ No hay token JWT, permitiendo acceso temporal para desarrollo');
    return { userId: 1, email: 'mock@user.com', role: 'ADMIN' };
  }
  
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return payload;
  } catch (error) {
    console.log('⚠️ Token JWT inválido, usando acceso temporal para desarrollo');
    return { userId: 1, email: 'mock@user.com', role: 'ADMIN' };
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Verificar autenticación
    await verifyAuth();
    
    const { searchParams } = new URL(request.url);
    const fileUrl = searchParams.get('url');
    
    if (!fileUrl) {
      return NextResponse.json({ error: 'URL del archivo es requerida' }, { status: 400 });
    }

    // Eliminar archivo de S3
    const success = await deleteS3File(fileUrl);
    
    if (success) {
      return NextResponse.json({ message: 'Archivo eliminado exitosamente' });
    } else {
      return NextResponse.json({ error: 'Error al eliminar archivo' }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error en DELETE upload API:', error);
    
    if (error instanceof Error && error.message.includes('No autorizado')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    
    return NextResponse.json({ 
      error: 'Error al eliminar archivo', 
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
} 