import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// GET /api/products/search?code=xxx - Buscar producto por código
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { error: 'Código de producto requerido' },
        { status: 400 }
      );
    }

    // TODO: Implementar autenticación cuando esté lista
    const companyId = 1;

    const product = await prisma.product.findFirst({
      where: {
        companyId: companyId,
        code: code,
        isActive: true
      },
      include: {
        category: true
      }
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    // Transformar datos para coincidir con la interfaz Product
    const transformedProduct = {
      ...product,
      images: product.images ? (product.images as string[]) : [],
      files: product.files ? (product.files as string[]) : []
    };

    return NextResponse.json(transformedProduct);
  } catch (error) {
    console.error('Error in GET /api/products/search:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 