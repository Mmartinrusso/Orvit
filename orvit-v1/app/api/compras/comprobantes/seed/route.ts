import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: { company: true },
        },
      },
    });

    return user;
  } catch (error) {
    console.error('[SEED COMPROBANTES] Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

// POST /api/compras/comprobantes/seed
// Crea 10 facturas de ejemplo para proveedor id 1 (01) en la empresa actual
export async function POST(_request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    // Verificar que exista proveedor 1 en esta compañía
    const proveedor = await prisma.suppliers.findFirst({
      where: { id: 1, company_id: companyId },
    });

    if (!proveedor) {
      return NextResponse.json(
        { error: 'No se encontró el proveedor con id 1 en esta empresa' },
        { status: 400 },
      );
    }

    // Buscar alguna cuenta de compras para usar como tipoCuentaId
    const cuenta = await prisma.purchaseAccount.findFirst({
      where: { companyId },
    });

    if (!cuenta) {
      return NextResponse.json(
        { error: 'No hay cuentas de compras (PurchaseAccount) creadas para esta empresa' },
        { status: 400 },
      );
    }

    const hoy = new Date();

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < 10; i++) {
        const numeroSerie = '00001';
        const numeroFactura = (1000 + i).toString().padStart(8, '0');

        const fechaEmision = new Date(hoy);
        fechaEmision.setDate(hoy.getDate() - (10 - i));

        const fechaVencimiento = new Date(fechaEmision);
        fechaVencimiento.setDate(fechaEmision.getDate() + 30);

        const neto = 100000 + i * 5000;
        const iva21 = neto * 0.21;
        const total = neto + iva21;

        const comprobante = await tx.purchaseReceipt.create({
          data: {
            numeroSerie,
            numeroFactura,
            tipo: 'FC',
            proveedorId: 1,
            fechaEmision,
            fechaVencimiento,
            fechaImputacion: fechaEmision,
            tipoPago: 'credito',
            metodoPago: 'transferencia',
            neto,
            iva21,
            noGravado: 0,
            impInter: 0,
            percepcionIVA: 0,
            percepcionIIBB: 0,
            otrosConceptos: 0,
            iva105: 0,
            iva27: 0,
            exento: 0,
            iibb: 0,
            total,
            tipoCuentaId: cuenta.id,
            estado: 'pendiente',
            observaciones: 'Factura demo generada automáticamente',
            companyId,
            createdBy: user.id,
          },
        });

        await tx.purchaseReceiptItem.create({
          data: {
            comprobanteId: comprobante.id,
            itemId: null,
            descripcion: `Item demo ${i + 1}`,
            cantidad: 1,
            unidad: 'UN',
            precioUnitario: neto,
            subtotal: neto,
            proveedorId: 1,
            companyId,
          },
        });
      }
    });

    return NextResponse.json({ ok: true, message: 'Se crearon 10 facturas de ejemplo para el proveedor 1.' });
  } catch (error) {
    console.error('[SEED COMPROBANTES] Error en POST:', error);
    return NextResponse.json(
      { error: 'Error al crear facturas de ejemplo' },
      { status: 500 },
    );
  }
}


