import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';

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

// GET - Obtener un contrato por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const contract = await prisma.serviceContract.findFirst({
      where: { id, companyId },
      include: {
        proveedor: {
          select: {
            id: true,
            name: true,
            cuit: true,
            email: true,
            phone: true
          }
        },
        machine: {
          select: {
            id: true,
            name: true,
            nickname: true,
            assetCode: true
          }
        },
        createdBy: {
          select: { id: true, name: true }
        },
        pagos: {
          orderBy: { periodoDesde: 'desc' },
          take: 12
        },
        alertas: {
          orderBy: { fechaAlerta: 'desc' },
          take: 10
        }
      }
    });

    if (!contract) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
    }

    // Calcular estado de pagos
    const pagosPendientes = contract.pagos.filter(p => p.estado === 'PENDIENTE').length;
    const pagosVencidos = contract.pagos.filter(p => p.estado === 'VENCIDO').length;

    return NextResponse.json({
      contract,
      stats: {
        pagosPendientes,
        pagosVencidos,
        diasParaVencimiento: contract.fechaFin
          ? Math.ceil((new Date(contract.fechaFin).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null
      }
    });
  } catch (error) {
    console.error('Error fetching service contract:', error);
    return NextResponse.json(
      { error: 'Error al obtener contrato' },
      { status: 500 }
    );
  }
}

// PATCH - Actualizar contrato
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const existing = await prisma.serviceContract.findFirst({
      where: { id, companyId }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const {
      numero,
      nombre,
      descripcion,
      tipo,
      estado,
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

    // Verificar número único si cambió
    if (numero?.trim() && numero.trim() !== existing.numero) {
      const duplicateNumero = await prisma.serviceContract.findFirst({
        where: {
          companyId,
          numero: numero.trim(),
          id: { not: id }
        }
      });

      if (duplicateNumero) {
        return NextResponse.json({ error: 'Ya existe un contrato con ese número' }, { status: 400 });
      }
    }

    // Verificar proveedor si cambió
    if (proveedorId && proveedorId !== existing.proveedorId) {
      const proveedor = await prisma.suppliers.findFirst({
        where: { id: proveedorId, company_id: companyId }
      });

      if (!proveedor) {
        return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 400 });
      }
    }

    // Verificar máquina si cambió
    if (machineId !== undefined && machineId !== null && machineId !== existing.machineId) {
      const machine = await prisma.machine.findFirst({
        where: { id: machineId, companyId }
      });

      if (!machine) {
        return NextResponse.json({ error: 'Máquina no encontrada' }, { status: 400 });
      }
    }

    const updateData: any = {};

    if (numero !== undefined) updateData.numero = numero.trim();
    if (nombre !== undefined) updateData.nombre = nombre.trim();
    if (descripcion !== undefined) updateData.descripcion = descripcion?.trim() || null;
    if (tipo !== undefined) updateData.tipo = tipo;
    if (estado !== undefined) updateData.estado = estado;
    if (proveedorId !== undefined) updateData.proveedorId = proveedorId;
    if (fechaInicio !== undefined) updateData.fechaInicio = new Date(fechaInicio);
    if (fechaFin !== undefined) updateData.fechaFin = fechaFin ? new Date(fechaFin) : null;
    if (diasAviso !== undefined) updateData.diasAviso = diasAviso;
    if (renovacionAuto !== undefined) updateData.renovacionAuto = renovacionAuto;
    if (montoTotal !== undefined) updateData.montoTotal = montoTotal;
    if (frecuenciaPago !== undefined) updateData.frecuenciaPago = frecuenciaPago;
    if (montoPeriodo !== undefined) updateData.montoPeriodo = montoPeriodo;
    if (moneda !== undefined) updateData.moneda = moneda;
    if (machineId !== undefined) updateData.machineId = machineId;
    if (polizaNumero !== undefined) updateData.polizaNumero = polizaNumero?.trim() || null;
    if (aseguradora !== undefined) updateData.aseguradora = aseguradora?.trim() || null;
    if (cobertura !== undefined) updateData.cobertura = cobertura?.trim() || null;
    if (sumaAsegurada !== undefined) updateData.sumaAsegurada = sumaAsegurada;
    if (deducible !== undefined) updateData.deducible = deducible;
    if (franquicia !== undefined) updateData.franquicia = franquicia;
    if (contactoNombre !== undefined) updateData.contactoNombre = contactoNombre?.trim() || null;
    if (contactoTelefono !== undefined) updateData.contactoTelefono = contactoTelefono?.trim() || null;
    if (contactoEmail !== undefined) updateData.contactoEmail = contactoEmail?.trim() || null;
    if (documentos !== undefined) updateData.documentos = documentos;
    if (notas !== undefined) updateData.notas = notas?.trim() || null;

    const contract = await prisma.serviceContract.update({
      where: { id },
      data: updateData,
      include: {
        proveedor: { select: { id: true, name: true } },
        machine: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } }
      }
    });

    // Actualizar alerta de vencimiento si cambió la fecha de fin
    if (fechaFin !== undefined) {
      // Eliminar alertas de vencimiento anteriores
      await prisma.serviceContractAlert.deleteMany({
        where: { contractId: id, tipo: 'VENCIMIENTO', enviada: false }
      });

      // Crear nueva alerta si tiene fecha de fin
      if (fechaFin) {
        const newFechaAlerta = new Date(fechaFin);
        newFechaAlerta.setDate(newFechaAlerta.getDate() - (diasAviso || contract.diasAviso || 30));

        await prisma.serviceContractAlert.create({
          data: {
            contractId: id,
            tipo: 'VENCIMIENTO',
            mensaje: `El contrato "${contract.nombre}" vence el ${new Date(fechaFin).toLocaleDateString('es-AR')}`,
            fechaAlerta: newFechaAlerta,
            companyId
          }
        });
      }
    }

    return NextResponse.json({ contract });
  } catch (error) {
    console.error('Error updating service contract:', error);
    return NextResponse.json(
      { error: 'Error al actualizar contrato' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar contrato
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const existing = await prisma.serviceContract.findFirst({
      where: { id, companyId },
      include: {
        _count: { select: { pagos: true } }
      }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
    }

    // Si tiene pagos registrados, solo marcar como cancelado
    if (existing._count.pagos > 0) {
      await prisma.serviceContract.update({
        where: { id },
        data: { estado: 'CANCELADO' }
      });

      return NextResponse.json({
        success: true,
        message: 'Contrato marcado como cancelado (tiene pagos registrados)'
      });
    }

    // Si no tiene pagos, eliminar completamente
    await prisma.$transaction([
      prisma.serviceContractAlert.deleteMany({ where: { contractId: id } }),
      prisma.serviceContract.delete({ where: { id } })
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting service contract:', error);
    return NextResponse.json(
      { error: 'Error al eliminar contrato' },
      { status: 500 }
    );
  }
}
