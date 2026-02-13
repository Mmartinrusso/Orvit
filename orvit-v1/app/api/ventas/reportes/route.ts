import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

// GET - Lista de reportes disponibles
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.REPORTES_VIEW);
    if (error) return error;

    const reportes = [
      {
        id: 'ventas-cliente',
        nombre: 'Ventas por Cliente',
        descripcion: 'Historial completo de ventas, facturas y pagos de un cliente',
        categoria: 'Clientes',
        parametros: ['clienteId', 'fechaDesde', 'fechaHasta'],
        icon: 'Users',
      },
      {
        id: 'ventas-vendedor',
        nombre: 'Ventas por Vendedor',
        descripcion: 'Performance de ventas por vendedor con totales y comisiones',
        categoria: 'Vendedores',
        parametros: ['vendedorId', 'fechaDesde', 'fechaHasta'],
        icon: 'UserCheck',
      },
      {
        id: 'ventas-periodo',
        nombre: 'Ventas por Período',
        descripcion: 'Análisis de ventas agrupadas por día, semana o mes',
        categoria: 'Análisis',
        parametros: ['agrupacion', 'fechaDesde', 'fechaHasta'],
        icon: 'Calendar',
      },
      {
        id: 'cobranzas-pendientes',
        nombre: 'Cobranzas Pendientes',
        descripcion: 'Facturas pendientes de cobro con aging (30/60/90 días)',
        categoria: 'Cobranzas',
        parametros: ['clienteId', 'diasMinimo'],
        icon: 'Clock',
      },
      {
        id: 'ranking-clientes',
        nombre: 'Ranking de Clientes',
        descripcion: 'Top clientes ordenados por volumen de compras',
        categoria: 'Rankings',
        parametros: ['fechaDesde', 'fechaHasta', 'limite'],
        icon: 'Trophy',
      },
      {
        id: 'ranking-productos',
        nombre: 'Ranking de Productos',
        descripcion: 'Productos más vendidos por cantidad o monto',
        categoria: 'Rankings',
        parametros: ['fechaDesde', 'fechaHasta', 'limite', 'ordenarPor'],
        icon: 'Package',
      },
      {
        id: 'estado-cuenta',
        nombre: 'Estado de Cuenta',
        descripcion: 'Movimientos de cuenta corriente de un cliente',
        categoria: 'Clientes',
        parametros: ['clienteId', 'fechaDesde', 'fechaHasta'],
        icon: 'FileText',
      },
      {
        id: 'resumen-ejecutivo',
        nombre: 'Resumen Ejecutivo',
        descripcion: 'Dashboard con métricas clave del período',
        categoria: 'Análisis',
        parametros: ['fechaDesde', 'fechaHasta'],
        icon: 'BarChart3',
      },
    ];

    return NextResponse.json({ reportes });
  } catch (error) {
    console.error('Error fetching reportes:', error);
    return NextResponse.json({ error: 'Error al obtener reportes' }, { status: 500 });
  }
}
