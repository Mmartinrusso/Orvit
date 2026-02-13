import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Cache agresivo en memoria (se resetea en cada reinicio del servidor)
const suppliersCache = new Map<string, { data: any[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos de cache

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    const companyIdNum = parseInt(companyId);
    
    // Verificar cache primero (rápido)
    const cacheKey = `suppliers-${companyIdNum}`;
    const cached = suppliersCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'public, max-age=300', // 5 minutos cache del navegador
          'X-Cache': 'HIT'
        }
      });
    }

    // Usar Prisma findMany con select específico (más rápido que raw query)
    const suppliers = await prisma.suppliers.findMany({
      where: {
        company_id: companyIdNum
      },
      select: {
        id: true,
        name: true,
        razon_social: true,
        contact_person: true,
        phone: true,
        email: true
      },
      orderBy: {
        name: 'asc'
      },
      take: 500
    });

    // Procesar rápidamente solo lo necesario
    const processedSuppliers = suppliers.map(s => ({
      id: s.id,
      name: s.name,
      razon_social: s.razon_social || s.name,
      contactPerson: s.contact_person,
      phone: s.phone,
      email: s.email
    }));

    // Guardar en cache
    suppliersCache.set(cacheKey, {
      data: processedSuppliers,
      timestamp: Date.now()
    });

    return NextResponse.json(processedSuppliers, {
      headers: {
        'Cache-Control': 'public, max-age=300',
        'X-Cache': 'MISS'
      }
    });

  } catch (error) {
    console.error('Error obteniendo proveedores:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, contactPerson, phone, email, address, companyId } = body;

    if (!name || !companyId) {
      return NextResponse.json(
        { error: 'Nombre y companyId son requeridos' },
        { status: 400 }
      );
    }

    const newSupplier = await prisma.$queryRaw`
      INSERT INTO suppliers (name, contact_person, phone, email, address, company_id)
      VALUES (${name}, ${contactPerson || null}, ${phone || null}, ${email || null}, ${address || null}, ${parseInt(companyId)})
      RETURNING id, name, contact_person as "contactPerson", phone, email, address, company_id as "companyId", created_at as "createdAt", updated_at as "updatedAt"
    `;

    // Invalidar cache
    const cacheKey = `suppliers-${parseInt(companyId)}`;
    suppliersCache.delete(cacheKey);

    return NextResponse.json((newSupplier as any[])[0]);

  } catch (error) {
    console.error('Error creando proveedor:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
