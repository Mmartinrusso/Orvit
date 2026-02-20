import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

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

// GET /api/compras/proveedores/[id] - Obtener proveedor por id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const proveedorId = parseInt(id);

    // Optimización: Usar select para obtener solo campos necesarios
    const proveedor = await prisma.suppliers.findFirst({
      where: {
        id: proveedorId,
        company_id: companyId,
      },
      select: {
        id: true,
        name: true,
        razon_social: true,
        codigo: true,
        cuit: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        postal_code: true,
        province: true,
        contact_person: true,
        contact_phone: true,
        contact_email: true,
        condiciones_pago: true,
        notes: true,
        ingresos_brutos: true,
        condicion_iva: true,
        cbu: true,
        alias_cbu: true,
        banco: true,
        tipo_cuenta: true,
        numero_cuenta: true,
        company_id: true,
        created_at: true,
      },
    });

    if (!proveedor) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    return NextResponse.json(proveedor, {
      headers: {
        'Cache-Control': 'public, max-age=60', // Cachear proveedores por 1 minuto
      }
    });
  } catch (error) {
    console.error('Error fetching proveedor:', error);
    return NextResponse.json(
      { error: 'Error al obtener el proveedor' },
      { status: 500 }
    );
  }
}

// PUT /api/compras/proveedores/[id] - Actualizar proveedor
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const proveedorId = parseInt(id);
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

    // Validar que el código (ID) no se repita en otro proveedor de la misma empresa
    if (codigo && codigo.trim()) {
      const existingWithCode = await prisma.suppliers.findFirst({
        where: {
          company_id: companyId,
          codigo: codigo.trim(),
          NOT: { id: proveedorId },
        },
      });

      if (existingWithCode) {
        return NextResponse.json(
          { error: 'Ya existe otro proveedor con ese ID/Código. Usá uno diferente.' },
          { status: 400 }
        );
      }
    }

    // Validar CUIT con algoritmo AFIP si fue proporcionado
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

      // Verificar duplicado de CUIT (excluyendo el proveedor actual)
      const cuitNormalizado = formattedCuit.replace(/-/g, '');
      const proveedoresConCuit = await prisma.suppliers.findMany({
        where: {
          company_id: companyId,
          cuit: { not: null },
          NOT: { id: proveedorId },
        },
        select: { id: true, name: true, cuit: true }
      });

      const duplicado = proveedoresConCuit.find(p =>
        p.cuit && p.cuit.replace(/-/g, '') === cuitNormalizado
      );

      if (duplicado) {
        return NextResponse.json(
          {
            error: `Ya existe un proveedor con CUIT ${formattedCuit}: "${duplicado.name}".`,
            existingId: duplicado.id,
            existingName: duplicado.name
          },
          { status: 400 }
        );
      }
    }

    // Verificar que el proveedor exista y pertenezca a la empresa
    const proveedorExistente = await prisma.suppliers.findFirst({
      where: {
        id: proveedorId,
        company_id: companyId,
      },
    });

    if (!proveedorExistente) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    // ============================================
    // ENFORCEMENT: Detectar cambios bancarios sensibles
    // Requieren doble aprobación
    // ============================================
    const camposBancarios = {
      cbu: cbu?.trim() || null,
      alias_cbu: aliasCbu?.trim() || null,
      banco: banco?.trim() || null,
      tipo_cuenta: tipoCuenta?.trim() || null,
      numero_cuenta: numeroCuenta?.trim() || null,
    };

    const datosAnterioresBancarios = {
      cbu: proveedorExistente.cbu,
      alias_cbu: proveedorExistente.alias_cbu,
      banco: proveedorExistente.banco,
      tipo_cuenta: proveedorExistente.tipo_cuenta,
      numero_cuenta: proveedorExistente.numero_cuenta,
    };

    // Detectar si hay cambios en datos bancarios
    const hayCambioBancario =
      camposBancarios.cbu !== datosAnterioresBancarios.cbu ||
      camposBancarios.alias_cbu !== datosAnterioresBancarios.alias_cbu ||
      camposBancarios.banco !== datosAnterioresBancarios.banco ||
      camposBancarios.tipo_cuenta !== datosAnterioresBancarios.tipo_cuenta ||
      camposBancarios.numero_cuenta !== datosAnterioresBancarios.numero_cuenta;

    // Si hay cambio bancario, verificar si ya tiene un cambio pendiente
    if (hayCambioBancario) {
      // Verificar si hay un cambio pendiente de aprobación
      const cambioPendiente = await prisma.supplierChangeRequest.findFirst({
        where: {
          supplierId: proveedorId,
          companyId,
          tipo: 'CAMBIO_BANCARIO',
          estado: 'PENDIENTE_APROBACION',
        },
      });

      if (cambioPendiente) {
        return NextResponse.json(
          {
            error: 'Ya existe una solicitud de cambio bancario pendiente de aprobación para este proveedor',
            code: 'CAMBIO_PENDIENTE',
            changeRequestId: cambioPendiente.id,
          },
          { status: 400 }
        );
      }

      // Crear solicitud de cambio bancario
      const changeRequest = await prisma.supplierChangeRequest.create({
        data: {
          supplierId: proveedorId,
          companyId,
          tipo: 'CAMBIO_BANCARIO',
          datosAnteriores: datosAnterioresBancarios,
          datosNuevos: camposBancarios,
          estado: 'PENDIENTE_APROBACION',
          solicitadoPor: user.id,
        },
      });

      console.log('[PROVEEDORES] ⚠️ Cambio bancario detectado, requiere aprobación:', changeRequest.id);

      // Actualizar SOLO los campos NO bancarios ahora
      const proveedorActualizadoParcial = await prisma.suppliers.update({
        where: { id: proveedorId },
        data: {
          name: nombre.trim(),
          razon_social: razonSocial.trim(),
          codigo: codigo?.trim() || null,
          cuit: formattedCuit || cuit?.trim() || null,
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
          // NO actualizar campos bancarios - requieren aprobación
          contact_phone: contactoTelefono?.trim() || null,
          contact_email: contactoEmail?.trim() || null,
          notes: notas?.trim() || null,
        },
      });

      return NextResponse.json({
        ...proveedorActualizadoParcial,
        message: 'Proveedor actualizado. Los cambios bancarios requieren aprobación.',
        requiresApproval: true,
        changeRequestId: changeRequest.id,
        pendingBankChanges: camposBancarios,
      });
    }

    // Sin cambios bancarios, actualizar todo normalmente
    const proveedorActualizado = await prisma.suppliers.update({
      where: { id: proveedorId },
      data: {
        name: nombre.trim(),
        razon_social: razonSocial.trim(),
        codigo: codigo?.trim() || null,
        cuit: formattedCuit || cuit?.trim() || null,
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
      },
    });

    return NextResponse.json(proveedorActualizado);
  } catch (error) {
    console.error('Error updating proveedor:', error);
    return NextResponse.json(
      { error: 'Error al actualizar el proveedor' },
      { status: 500 }
    );
  }
}

// DELETE /api/compras/proveedores/[id] - Eliminar proveedor
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const proveedorId = parseInt(id);

    // Verificar que el proveedor exista y pertenezca a la empresa
    const proveedorExistente = await prisma.suppliers.findFirst({
      where: {
        id: proveedorId,
        company_id: companyId,
      },
    });

    if (!proveedorExistente) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    // Verificar si el proveedor tiene registros asociados que impidan eliminarlo.
    // Solo se consultan las tablas que existen en la DB actual; el fallback P2003 cubre el resto.
    const [facturas, ordenes, recepciones] = await Promise.all([
      prisma.purchaseReceipt.count({ where: { proveedorId } }),
      prisma.purchaseOrder.count({ where: { proveedorId } }),
      prisma.goodsReceipt.count({ where: { proveedorId } }),
    ]);

    const totalAsociados = facturas + ordenes + recepciones;
    if (totalAsociados > 0) {
      const detalle: string[] = [];
      if (facturas > 0) detalle.push(`${facturas} comprobante${facturas !== 1 ? 's' : ''}`);
      if (ordenes > 0) detalle.push(`${ordenes} orden${ordenes !== 1 ? 'es' : ''} de compra`);
      if (recepciones > 0) detalle.push(`${recepciones} recepción${recepciones !== 1 ? 'es' : ''}`);
      return NextResponse.json(
        { error: `No se puede eliminar el proveedor porque tiene ${detalle.join(', ')} asociado${detalle.length !== 1 ? 's' : ''}. Desactivelo en su lugar.` },
        { status: 409 }
      );
    }

    await prisma.suppliers.delete({
      where: { id: proveedorId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // Fallback: si Prisma lanza P2003 (foreign key) que no hayamos chequeado arriba
    if (error?.code === 'P2003') {
      return NextResponse.json(
        { error: 'No se puede eliminar el proveedor porque tiene documentos asociados. Desactivelo en su lugar.' },
        { status: 409 }
      );
    }
    console.error('Error deleting proveedor:', error);
    return NextResponse.json(
      { error: 'Error al eliminar el proveedor' },
      { status: 500 }
    );
  }
}

// PATCH /api/compras/proveedores/[id] - Activar o desactivar proveedor
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const proveedorId = parseInt(id);

    const proveedor = await prisma.suppliers.findFirst({
      where: { id: proveedorId, company_id: companyId },
      select: { id: true, isBlocked: true },
    });

    if (!proveedor) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    const updated = await prisma.suppliers.update({
      where: { id: proveedorId },
      data: { isBlocked: !proveedor.isBlocked },
      select: { id: true, isBlocked: true },
    });

    return NextResponse.json({ success: true, isBlocked: updated.isBlocked });
  } catch (error) {
    console.error('Error toggling proveedor:', error);
    return NextResponse.json({ error: 'Error al actualizar el proveedor' }, { status: 500 });
  }
}
