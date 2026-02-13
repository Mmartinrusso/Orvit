import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        companies: {
          select: { companyId: true },
          take: 1
        }
      }
    });

    return user;
  } catch {
    return null;
  }
}

// GET - Buscar items del proveedor
export async function GET(request: NextRequest) {
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
    const supplierId = searchParams.get('supplierId');
    const codigo = searchParams.get('codigo');
    const codigoPropio = searchParams.get('codigoPropio');
    const descripcion = searchParams.get('descripcion');
    const unidad = searchParams.get('unidad');
    const search = searchParams.get('search');
    const autoCreate = searchParams.get('autoCreate') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20');

    // Si hay búsqueda pero NO supplierId, buscar en todos los items de la empresa
    // Usado por: ajustes de inventario, búsqueda global, etc.
    if (search && !supplierId && !codigo) {
      const items = await prisma.supplierItem.findMany({
        where: {
          companyId,
          activo: true,
          OR: [
            { nombre: { contains: search, mode: 'insensitive' } },
            { descripcion: { contains: search, mode: 'insensitive' } },
            { codigoProveedor: { contains: search, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          nombre: true,
          codigoProveedor: true,
          unidad: true,
          precioUnitario: true,
          supplier: {
            select: { id: true, name: true }
          },
          supply: {
            select: { id: true, code: true, name: true }
          }
        },
        take: limit,
        orderBy: { nombre: 'asc' }
      });
      return NextResponse.json({ data: items });
    }

    // Para operaciones que requieren proveedor específico (crear, buscar por código)
    if (!supplierId && (codigo || autoCreate)) {
      return NextResponse.json({ error: 'supplierId es requerido' }, { status: 400 });
    }

    // Si no hay search ni código ni supplierId, error
    if (!supplierId && !search) {
      return NextResponse.json({ error: 'supplierId o search es requerido' }, { status: 400 });
    }

    const supplierIdNum = supplierId ? parseInt(supplierId) : 0;

    // Buscar por codigo del proveedor
    if (codigo) {
      let item = await prisma.supplierItem.findFirst({
        where: {
          supplierId: supplierIdNum,
          companyId,
          codigoProveedor: codigo
        },
        select: {
          id: true,
          nombre: true,
          codigoProveedor: true,
          unidad: true,
          precioUnitario: true,
          supply: {
            select: {
              id: true,
              code: true,
              name: true
            }
          }
        }
      });

      // Si no existe y autoCreate está habilitado, crear el item
      if (!item && autoCreate) {
        try {
          // Buscar supply existente por codigo propio o por codigo de cotización
          const codeToUse = codigoPropio || `COT-${codigo}`;
          let supply = await prisma.supplies.findFirst({
            where: { company_id: companyId, code: codeToUse }
          });

          if (!supply) {
            // Crear nuevo supply
            supply = await prisma.supplies.create({
              data: {
                code: codeToUse,
                name: descripcion || `Item ${codigo}`,
                unit_measure: unidad || 'UN',
                company_id: companyId,
                is_active: true
              }
            });
          }

          // Verificar si ya existe un SupplierItem para este proveedor y supply
          let existingSupplierItem = await prisma.supplierItem.findFirst({
            where: {
              supplierId: supplierIdNum,
              supplyId: supply.id,
              companyId
            },
            select: {
              id: true,
              nombre: true,
              codigoProveedor: true,
              unidad: true,
              precioUnitario: true,
              supply: {
                select: {
                  id: true,
                  code: true,
                  name: true
                }
              }
            }
          });

          if (existingSupplierItem) {
            // Ya existe, actualizar el código del proveedor si no lo tiene
            if (!existingSupplierItem.codigoProveedor) {
              await prisma.supplierItem.update({
                where: { id: existingSupplierItem.id },
                data: { codigoProveedor: codigo }
              });
              existingSupplierItem.codigoProveedor = codigo;
            }
            return NextResponse.json({ data: [existingSupplierItem], created: false });
          }

          // Crear el SupplierItem
          const newItem = await prisma.supplierItem.create({
            data: {
              supplierId: supplierIdNum,
              supplyId: supply.id,
              nombre: descripcion || `Item ${codigo}`,
              codigoProveedor: codigo,
              unidad: unidad || 'UN',
              activo: true,
              companyId: companyId
            },
            select: {
              id: true,
              nombre: true,
              codigoProveedor: true,
              unidad: true,
              precioUnitario: true,
              supply: {
                select: {
                  id: true,
                  code: true,
                  name: true
                }
              }
            }
          });

          return NextResponse.json({ data: [newItem], created: true });
        } catch (createError: any) {
          console.error('[supplier-items] Error creating item:', createError);
          // Si falla la creación, devolver array vacío en lugar de error 500
          return NextResponse.json({ data: [], error: 'No se pudo crear el item' });
        }
      }

      return NextResponse.json({ data: item ? [item] : [] });
    }

    // Buscar por texto
    const where: any = {
      supplierId: supplierIdNum,
      companyId,
      activo: true
    };

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { descripcion: { contains: search, mode: 'insensitive' } },
        { codigoProveedor: { contains: search, mode: 'insensitive' } },
        // Buscar por descripcionItem en stockLocations
        { stockLocations: { some: { descripcionItem: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const items = await prisma.supplierItem.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        codigoProveedor: true,
        unidad: true,
        precioUnitario: true,
        supply: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      },
      take: 20,
      orderBy: { nombre: 'asc' }
    });

    return NextResponse.json({ data: items });
  } catch (error: any) {
    console.error('[supplier-items] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error al buscar items del proveedor' },
      { status: 500 }
    );
  }
}
