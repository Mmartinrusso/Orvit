/**
 * API: /api/mantenimiento/unidades-moviles/export
 *
 * GET - Exportar unidades móviles a CSV
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

// Schema de validación para query params
const exportParamsSchema = z.object({
  companyId: z.coerce.number().int().positive('Company ID inválido'),
  format: z.enum(['csv', 'json']).default('csv'),
  estado: z.enum(['ACTIVO', 'MANTENIMIENTO', 'FUERA_SERVICIO', 'DESHABILITADO']).optional(),
  sectorId: z.coerce.number().int().optional(),
  tipo: z.string().optional()
});

export const dynamic = 'force-dynamic';

// GET - Exportar unidades
export async function GET(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // 2. Parsear query params
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());

    const validation = exportParamsSchema.safeParse(params);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { format, estado, sectorId, tipo } = validation.data;
    const companyId = payload.companyId as number; // Siempre del JWT

    // 3. Construir filtro WHERE
    const where: any = { companyId };
    if (estado) where.estado = estado;
    if (sectorId) where.sectorId = sectorId;
    if (tipo) where.tipo = tipo;

    // 4. Obtener unidades
    const unidades = await prisma.unidadMovil.findMany({
      where,
      include: {
        sector: {
          select: { name: true }
        },
        _count: {
          select: {
            workOrders: {
              where: { status: { in: ['PENDING', 'IN_PROGRESS'] } }
            }
          }
        }
      },
      orderBy: { nombre: 'asc' }
    });

    // 5. Formatear respuesta
    if (format === 'json') {
      return NextResponse.json({
        success: true,
        count: unidades.length,
        unidades: unidades.map(u => ({
          id: u.id,
          nombre: u.nombre,
          tipo: u.tipo,
          marca: u.marca,
          modelo: u.modelo,
          año: u.año,
          patente: u.patente,
          kilometraje: u.kilometraje,
          estado: u.estado,
          sector: u.sector?.name || '',
          combustible: u.combustible || '',
          workOrdersActivas: u._count.workOrders,
          proximoMantenimiento: u.proximoMantenimiento,
          fechaAdquisicion: u.fechaAdquisicion,
          valorAdquisicion: u.valorAdquisicion
        }))
      });
    }

    // 6. Generar CSV
    const headers = [
      'ID',
      'Nombre',
      'Tipo',
      'Marca',
      'Modelo',
      'Año',
      'Patente',
      'Kilometraje',
      'Estado',
      'Sector',
      'Combustible',
      'OTs Activas',
      'Próximo Mantenimiento',
      'Fecha Adquisición',
      'Valor Adquisición',
      'Número Chasis',
      'Número Motor',
      'Capacidad Combustible (L)',
      'Consumo Promedio (L/100km)'
    ];

    const formatDate = (date: Date | null) => {
      if (!date) return '';
      return new Date(date).toLocaleDateString('es-AR');
    };

    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = unidades.map(u => [
      u.id,
      escapeCSV(u.nombre),
      escapeCSV(u.tipo),
      escapeCSV(u.marca),
      escapeCSV(u.modelo),
      u.año,
      escapeCSV(u.patente),
      u.kilometraje,
      u.estado,
      escapeCSV(u.sector?.name || ''),
      escapeCSV(u.combustible || ''),
      u._count.workOrders,
      formatDate(u.proximoMantenimiento),
      formatDate(u.fechaAdquisicion),
      u.valorAdquisicion || '',
      escapeCSV(u.numeroChasis || ''),
      escapeCSV(u.numeroMotor || ''),
      u.capacidadCombustible || '',
      u.consumoPromedio || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // 7. Retornar CSV con headers apropiados
    const filename = `unidades-moviles-${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('❌ Error en GET /api/mantenimiento/unidades-moviles/export:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
