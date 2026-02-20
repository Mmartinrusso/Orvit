import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { withComprasGuards } from '@/lib/modules';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Caché en memoria para proveedores (5 minutos TTL)
const proveedoresCache = new Map<string, { data: any; timestamp: number }>();
const PROVEEDORES_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Helper para obtener usuario desde JWT (optimizado)
async function getUserFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    // Optimización: Solo obtener companyId sin incluir toda la relación
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        companies: {
          select: {
            companyId: true
          },
          take: 1
        }
      }
    });

    return user;
  } catch (error) {
    console.error('Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

// GET /api/compras/proveedores - Obtener proveedores con búsqueda
// Protegido por módulo purchases_core
export const GET = withComprasGuards(async (request: NextRequest) => {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const showInactive = searchParams.get('showInactive') === 'true';

    // Generar clave de caché
    const cacheKey = `proveedores-${companyId}-${search || 'all'}-${showInactive}`;
    const cached = proveedoresCache.get(cacheKey);
    
    // Solo usar caché si no hay búsqueda (las búsquedas deben ser dinámicas)
    if (!search && cached && Date.now() - cached.timestamp < PROVEEDORES_CACHE_TTL) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'public, max-age=300',
          'X-Cache': 'HIT'
        }
      });
    }

    const where: any = {
      company_id: companyId,
      // Por defecto solo mostrar activos; con showInactive=true mostrar todos
      ...(!showInactive && { isBlocked: false }),
    };

    // Si hay búsqueda, buscar por nombre, razón social, CUIT o código
    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { razon_social: { contains: searchTerm, mode: 'insensitive' } },
        { cuit: { contains: searchTerm } },
        { codigo: { contains: searchTerm } },
      ];
    }

    // ULTRA OPTIMIZACIÓN: Solo seleccionar campos mínimos necesarios
    const proveedores = await prisma.suppliers.findMany({
      where,
      select: {
        id: true,
        name: true,
        razon_social: true,
        cuit: true,
        codigo: true,
        isBlocked: true,
      },
      orderBy: {
        name: 'asc',
      },
      take: 200, // Límite muy reducido para máximo rendimiento
    });

    // Guardar en caché solo si no hay búsqueda
    if (!search) {
      proveedoresCache.set(cacheKey, {
        data: proveedores,
        timestamp: Date.now()
      });

      // Limpiar caché antiguo
      if (proveedoresCache.size > 50) {
        const now = Date.now();
        for (const [key, value] of proveedoresCache.entries()) {
          if (now - value.timestamp > PROVEEDORES_CACHE_TTL) {
            proveedoresCache.delete(key);
          }
        }
      }
    }

    return NextResponse.json(proveedores, {
      headers: {
        'Cache-Control': 'public, max-age=300',
        'X-Cache': search ? 'BYPASS' : 'MISS'
      }
    });
  } catch (error) {
    console.error('Error fetching proveedores:', error);
    return NextResponse.json(
      { error: 'Error al obtener los proveedores' },
      { status: 500 }
    );
  }
});

// POST /api/compras/proveedores - Crear nuevo proveedor
// Protegido por módulo purchases_core
export const POST = withComprasGuards(async (request: NextRequest) => {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const body = await request.json();
    const {
      nombre,
      razonSocial,
      codigo,
      cuit,
      email,
      telefono,
      direccion,
      ciudad,
      codigoPostal,
      provincia,
      contactoNombre,
      contactoTelefono,
      contactoEmail,
      condicionesPago,
      notas,
      ingresosBrutos,
      condicionIva,
      cbu,
      aliasCbu,
      banco,
      tipoCuenta,
      numeroCuenta,
    } = body;

    if (!nombre || !nombre.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    if (!razonSocial || !razonSocial.trim()) {
      return NextResponse.json({ error: 'La razón social es requerida' }, { status: 400 });
    }

    // Validar que el código (ID) de proveedor no esté repetido dentro de la misma empresa
    if (codigo && codigo.trim()) {
      const existingWithCode = await prisma.suppliers.findFirst({
        where: {
          company_id: companyId,
          codigo: codigo.trim(),
        },
      });

      if (existingWithCode) {
        return NextResponse.json(
          { error: 'Ya existe otro proveedor con ese ID/Código. Usá uno diferente.' },
          { status: 400 }
        );
      }
    }

    // Validar CUIT con algoritmo AFIP y verificar duplicados
    let formattedCuit: string | null = null;
    if (cuit && cuit.trim()) {
      const { validateCUIT } = await import('@/lib/ventas/cuit-validator');
      const cuitValidation = validateCUIT(cuit.trim());

      if (!cuitValidation.valid) {
        return NextResponse.json(
          { error: `CUIT inválido: ${cuitValidation.error}` },
          { status: 400 }
        );
      }

      formattedCuit = cuitValidation.formatted!;

      // Normalizar CUIT quitando guiones para comparar
      const cuitNormalizado = formattedCuit.replace(/-/g, '');

      // Buscar proveedores con CUIT para verificar duplicados
      const proveedoresConCuit = await prisma.suppliers.findMany({
        where: {
          company_id: companyId,
          cuit: { not: null }
        },
        select: { id: true, name: true, cuit: true }
      });

      const duplicado = proveedoresConCuit.find(p =>
        p.cuit && p.cuit.replace(/-/g, '') === cuitNormalizado
      );

      if (duplicado) {
        return NextResponse.json(
          {
            error: `Ya existe un proveedor con CUIT ${formattedCuit}: "${duplicado.name}". Seleccionalo de la lista.`,
            existingId: duplicado.id,
            existingName: duplicado.name
          },
          { status: 400 }
        );
      }
    }

    // Crear proveedor en la tabla suppliers
    const nuevoProveedor = await prisma.suppliers.create({
      data: {
        name: nombre.trim(),
        razon_social: razonSocial.trim(),
        codigo: codigo?.trim() || null,
        cuit: formattedCuit || null,
        contact_person: contactoNombre?.trim() || null,
        phone: telefono?.trim() || null,
        email: email?.trim() || null,
        address: direccion?.trim() || null,
        city: ciudad?.trim() || null,
        postal_code: codigoPostal?.trim() || null,
        province: provincia?.trim() || null,
        condiciones_pago: condicionesPago?.trim() || null,
        ingresos_brutos: ingresosBrutos?.trim() || null,
        condicion_iva: condicionIva?.trim() || null,
        cbu: cbu?.trim() || null,
        alias_cbu: aliasCbu?.trim() || null,
        banco: banco?.trim() || null,
        tipo_cuenta: tipoCuenta?.trim() || null,
        numero_cuenta: numeroCuenta?.trim() || null,
        contact_phone: contactoTelefono?.trim() || null,
        contact_email: contactoEmail?.trim() || null,
        notes: notas?.trim() || null,
        company_id: companyId,
      },
    });

    // Invalidar caché
    proveedoresCache.delete(`proveedores-${companyId}-all`);

    return NextResponse.json(nuevoProveedor, { status: 201 });
  } catch (error) {
    console.error('Error creating proveedor:', error);
    return NextResponse.json(
      { error: 'Error al crear el proveedor' },
      { status: 500 }
    );
  }
});
