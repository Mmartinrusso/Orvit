import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        name: true,
        companies: {
          select: { companyId: true },
          take: 1
        }
      }
    });

    return user;
  } catch (error) {
    return null;
  }
}

interface ReplenishmentSuggestion {
  id: number;
  supplierItemId: number;
  supplierItemNombre: string;
  supplierItemCodigo?: string;
  unidad: string;
  proveedorId: number;
  proveedorNombre: string;
  warehouseId: number;
  warehouseCodigo: string;
  stockActual: number;
  stockReservado: number;
  stockDisponible: number;
  enCamino: number;
  stockMinimo: number;
  stockMaximo?: number;
  cantidadSugerida: number;
  costoUnitario: number;
  valorSugerido: number;
  urgencia: 'CRITICA' | 'ALTA' | 'NORMAL' | 'BAJA';
  criticidad?: string;
}

// GET - Listar sugerencias de reposición
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
    const urgencia = searchParams.get('urgencia');
    const proveedorId = searchParams.get('proveedorId');
    const warehouseId = searchParams.get('warehouseId');

    // Reposiciones NO filtra por ViewMode porque solo sugiere compras
    // (no importa si el item original fue T1 o T2, si necesita restock se muestra)
    const stockLocations = await prisma.stockLocation.findMany({
      where: {
        companyId,
        stockMinimo: { gt: 0 }, // Solo items con mínimo configurado
        warehouse: { isTransit: false }
      },
      include: {
        supplierItem: {
          select: {
            id: true,
            nombre: true,
            codigoProveedor: true,
            unidad: true,
            supplierId: true,
            supplier: {
              select: { id: true, name: true, razon_social: true }
            }
          }
        },
        warehouse: {
          select: { id: true, codigo: true, nombre: true }
        }
      }
    });

    // Calcular "en camino" para cada supplierItem
    const supplierItemIds = stockLocations.map(s => s.supplierItemId);
    const enCaminoByItem = new Map<number, number>();

    if (supplierItemIds.length > 0) {
      const ocPendientes = await prisma.purchaseOrderItem.findMany({
        where: {
          supplierItemId: { in: supplierItemIds },
          purchaseOrder: {
            companyId,
            estado: { in: ['ENVIADA_PROVEEDOR', 'CONFIRMADA', 'PARCIALMENTE_RECIBIDA'] }
          }
        },
        select: {
          supplierItemId: true,
          cantidad: true,
          cantidadRecibida: true
        }
      });

      for (const item of ocPendientes) {
        const pendiente = Number(item.cantidad || 0) - Number(item.cantidadRecibida || 0);
        if (pendiente > 0) {
          const current = enCaminoByItem.get(item.supplierItemId) || 0;
          enCaminoByItem.set(item.supplierItemId, current + pendiente);
        }
      }
    }

    // Calcular sugerencias
    const sugerencias: ReplenishmentSuggestion[] = [];

    for (const loc of stockLocations) {
      const stockActual = Number(loc.cantidad || 0);
      const stockReservado = Number(loc.cantidadReservada || 0);
      const stockDisponible = stockActual - stockReservado;
      const enCamino = enCaminoByItem.get(loc.supplierItemId) || 0;
      const stockMinimo = Number(loc.stockMinimo || 0);
      const stockMaximo = Number(loc.stockMaximo || 0);
      const puntoReposicion = Number(loc.puntoReposicion || stockMinimo);
      const costoUnitario = Number(loc.costoUnitario || 0);

      // Fórmula: sugerirReposicion si stockDisponible + enCamino <= puntoReposicion
      const nivelTotal = stockDisponible + enCamino;

      if (nivelTotal <= puntoReposicion) {
        // Calcular cantidad sugerida (llevar a stockMaximo o stockMinimo * 1.5)
        const objetivo = stockMaximo > 0 ? stockMaximo : (stockMinimo * 1.5);
        const cantidadSugerida = Math.max(0, objetivo - stockDisponible - enCamino);

        if (cantidadSugerida <= 0) continue;

        // Calcular urgencia
        let urgenciaCalc: 'CRITICA' | 'ALTA' | 'NORMAL' | 'BAJA';
        if (stockDisponible <= 0) {
          urgenciaCalc = 'CRITICA';
        } else if (nivelTotal < stockMinimo * 0.25) {
          urgenciaCalc = 'ALTA';
        } else if (nivelTotal < stockMinimo * 0.5) {
          urgenciaCalc = 'NORMAL';
        } else {
          urgenciaCalc = 'BAJA';
        }

        sugerencias.push({
          id: loc.id,
          supplierItemId: loc.supplierItemId,
          supplierItemNombre: loc.supplierItem?.nombre || '',
          supplierItemCodigo: loc.supplierItem?.codigoProveedor || undefined,
          unidad: loc.supplierItem?.unidad || 'UN',
          proveedorId: loc.supplierItem?.supplierId || 0,
          proveedorNombre: loc.supplierItem?.supplier?.razon_social || loc.supplierItem?.supplier?.name || '',
          warehouseId: loc.warehouseId,
          warehouseCodigo: loc.warehouse?.codigo || '',
          stockActual,
          stockReservado,
          stockDisponible,
          enCamino,
          stockMinimo,
          stockMaximo: stockMaximo > 0 ? stockMaximo : undefined,
          cantidadSugerida: Math.round(cantidadSugerida * 100) / 100,
          costoUnitario,
          valorSugerido: Math.round(cantidadSugerida * costoUnitario * 100) / 100,
          urgencia: urgenciaCalc,
          criticidad: loc.criticidad || undefined
        });
      }
    }

    // Filtrar por urgencia si se especificó
    let resultado = sugerencias;
    if (urgencia) {
      resultado = sugerencias.filter(s => s.urgencia === urgencia);
    }
    if (proveedorId) {
      resultado = resultado.filter(s => s.proveedorId === parseInt(proveedorId));
    }
    if (warehouseId) {
      resultado = resultado.filter(s => s.warehouseId === parseInt(warehouseId));
    }

    // Ordenar por urgencia y luego por valor
    const urgenciaOrder = { CRITICA: 0, ALTA: 1, NORMAL: 2, BAJA: 3 };
    resultado.sort((a, b) => {
      const urgDiff = urgenciaOrder[a.urgencia] - urgenciaOrder[b.urgencia];
      if (urgDiff !== 0) return urgDiff;
      return b.valorSugerido - a.valorSugerido;
    });

    // KPIs
    const kpis = {
      total: resultado.length,
      criticas: resultado.filter(s => s.urgencia === 'CRITICA').length,
      altas: resultado.filter(s => s.urgencia === 'ALTA').length,
      normales: resultado.filter(s => s.urgencia === 'NORMAL').length,
      bajas: resultado.filter(s => s.urgencia === 'BAJA').length,
      valorTotal: Math.round(resultado.reduce((sum, s) => sum + s.valorSugerido, 0) * 100) / 100
    };

    return NextResponse.json({
      data: resultado,
      kpis
    });
  } catch (error) {
    console.error('Error fetching reposicion:', error);
    return NextResponse.json(
      { error: 'Error al obtener sugerencias de reposición' },
      { status: 500 }
    );
  }
}
