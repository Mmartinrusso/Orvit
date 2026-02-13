import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { getViewMode } from '@/lib/view-mode/get-mode';
import { applyViewMode } from '@/lib/view-mode/prisma-helper';

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

// GET - Listar contratos de servicios
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

    const viewMode = getViewMode(request);
    const { searchParams } = new URL(request.url);

    const tipo = searchParams.get('tipo');
    const estado = searchParams.get('estado');
    const proveedorId = searchParams.get('proveedorId');
    const machineId = searchParams.get('machineId');
    const search = searchParams.get('search');
    const porVencer = searchParams.get('porVencer') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = applyViewMode({ companyId }, viewMode);

    if (tipo) where.tipo = tipo;
    if (estado) where.estado = estado;
    if (proveedorId) where.proveedorId = parseInt(proveedorId);
    if (machineId) where.machineId = parseInt(machineId);

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { numero: { contains: search, mode: 'insensitive' } },
        { polizaNumero: { contains: search, mode: 'insensitive' } },
        { proveedor: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    // Filtro por vencimiento próximo (30 días)
    if (porVencer) {
      const now = new Date();
      const treintaDias = new Date();
      treintaDias.setDate(treintaDias.getDate() + 30);
      where.fechaFin = { gte: now, lte: treintaDias };
      where.estado = { in: ['ACTIVO', 'POR_VENCER'] };
    }

    const [contracts, total] = await Promise.all([
      prisma.serviceContract.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: [{ fechaFin: 'asc' }, { createdAt: 'desc' }],
        include: {
          proveedor: {
            select: { id: true, name: true, cuit: true }
          },
          machine: {
            select: { id: true, name: true, nickname: true }
          },
          createdBy: {
            select: { id: true, name: true }
          },
          _count: {
            select: { pagos: true, alertas: true }
          }
        }
      }),
      prisma.serviceContract.count({ where })
    ]);

    // Agregar KPIs
    const now = new Date();
    const treintaDias = new Date();
    treintaDias.setDate(now.getDate() + 30);

    const kpis = await prisma.serviceContract.groupBy({
      by: ['estado'],
      where: applyViewMode({ companyId }, viewMode),
      _count: true,
      _sum: { montoPeriodo: true }
    });

    const porVencerCount = await prisma.serviceContract.count({
      where: applyViewMode({
        companyId,
        fechaFin: { gte: now, lte: treintaDias },
        estado: { in: ['ACTIVO', 'POR_VENCER'] }
      }, viewMode)
    });

    const gastoMensual = await prisma.serviceContract.aggregate({
      where: applyViewMode({
        companyId,
        estado: 'ACTIVO',
        frecuenciaPago: 'MENSUAL'
      }, viewMode),
      _sum: { montoPeriodo: true }
    });

    return NextResponse.json({
      contracts,
      total,
      kpis: {
        byEstado: kpis,
        porVencer: porVencerCount,
        gastoMensualEstimado: Number(gastoMensual._sum.montoPeriodo || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching service contracts:', error);
    return NextResponse.json(
      { error: 'Error al obtener contratos' },
      { status: 500 }
    );
  }
}

// POST - Crear nuevo contrato de servicio
export async function POST(request: NextRequest) {
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
      numero,
      nombre,
      descripcion,
      tipo,
      proveedorId,
      fechaInicio,
      fechaFin,
      diasAviso,
      renovacionAuto,
      montoTotal,
      frecuenciaPago,
      montoPeriodo,
      moneda,
      machineId,
      polizaNumero,
      aseguradora,
      cobertura,
      sumaAsegurada,
      deducible,
      franquicia,
      contactoNombre,
      contactoTelefono,
      contactoEmail,
      documentos,
      notas
    } = body;

    // Validaciones
    if (!numero?.trim()) {
      return NextResponse.json({ error: 'El número de contrato es requerido' }, { status: 400 });
    }
    if (!nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }
    if (!tipo) {
      return NextResponse.json({ error: 'El tipo de contrato es requerido' }, { status: 400 });
    }
    if (!proveedorId) {
      return NextResponse.json({ error: 'El proveedor es requerido' }, { status: 400 });
    }
    if (!fechaInicio) {
      return NextResponse.json({ error: 'La fecha de inicio es requerida' }, { status: 400 });
    }

    // Verificar número único
    const existingNumero = await prisma.serviceContract.findFirst({
      where: { companyId, numero: numero.trim() }
    });

    if (existingNumero) {
      return NextResponse.json({ error: 'Ya existe un contrato con ese número' }, { status: 400 });
    }

    // Verificar proveedor existe
    const proveedor = await prisma.suppliers.findFirst({
      where: { id: proveedorId, company_id: companyId }
    });

    if (!proveedor) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 400 });
    }

    // Verificar máquina existe (si se especificó)
    if (machineId) {
      const machine = await prisma.machine.findFirst({
        where: { id: machineId, companyId }
      });

      if (!machine) {
        return NextResponse.json({ error: 'Máquina no encontrada' }, { status: 400 });
      }
    }

    const contract = await prisma.serviceContract.create({
      data: {
        numero: numero.trim(),
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        tipo,
        estado: 'ACTIVO',
        proveedorId,
        fechaInicio: new Date(fechaInicio),
        fechaFin: fechaFin ? new Date(fechaFin) : null,
        diasAviso: diasAviso ?? 30,
        renovacionAuto: renovacionAuto ?? false,
        montoTotal: montoTotal || null,
        frecuenciaPago: frecuenciaPago || 'MENSUAL',
        montoPeriodo: montoPeriodo || null,
        moneda: moneda || 'ARS',
        machineId: machineId || null,
        polizaNumero: polizaNumero?.trim() || null,
        aseguradora: aseguradora?.trim() || null,
        cobertura: cobertura?.trim() || null,
        sumaAsegurada: sumaAsegurada || null,
        deducible: deducible || null,
        franquicia: franquicia || null,
        contactoNombre: contactoNombre?.trim() || null,
        contactoTelefono: contactoTelefono?.trim() || null,
        contactoEmail: contactoEmail?.trim() || null,
        documentos: documentos || null,
        notas: notas?.trim() || null,
        companyId,
        createdById: user.id
      },
      include: {
        proveedor: { select: { id: true, name: true } },
        machine: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } }
      }
    });

    // Crear alerta de vencimiento si tiene fecha de fin
    if (fechaFin) {
      const fechaAlerta = new Date(fechaFin);
      fechaAlerta.setDate(fechaAlerta.getDate() - (diasAviso || 30));

      await prisma.serviceContractAlert.create({
        data: {
          contractId: contract.id,
          tipo: 'VENCIMIENTO',
          mensaje: `El contrato "${nombre}" vence el ${new Date(fechaFin).toLocaleDateString('es-AR')}`,
          fechaAlerta,
          companyId
        }
      });
    }

    return NextResponse.json({ contract }, { status: 201 });
  } catch (error) {
    console.error('Error creating service contract:', error);
    return NextResponse.json(
      { error: 'Error al crear contrato' },
      { status: 500 }
    );
  }
}
