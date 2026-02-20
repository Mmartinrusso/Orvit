import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { withComprasGuards } from '@/lib/modules';

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
        companies: { select: { companyId: true }, take: 1 },
      },
    });
    return user;
  } catch {
    return null;
  }
}

export interface ProveedorBulkInput {
  nombre: string;
  razonSocial?: string;
  codigo?: string;
  cuit?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  provincia?: string;
  codigoPostal?: string;
  contactoNombre?: string;
  contactoEmail?: string;
  contactoTelefono?: string;
  condicionesPago?: string;
  condicionIva?: string;
  ingresosBrutos?: string;
  notas?: string;
  cbu?: string;
  aliasCbu?: string;
  banco?: string;
  tipoCuenta?: string;
  numeroCuenta?: string;
}

// POST /api/compras/proveedores/bulk - Crear proveedores en lote
export const POST = withComprasGuards(async (request: NextRequest) => {
  try {
    const user = await getUserFromToken();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });

    const body = await request.json();
    const { proveedores } = body as { proveedores: ProveedorBulkInput[] };

    if (!Array.isArray(proveedores) || proveedores.length === 0) {
      return NextResponse.json({ error: 'Se requiere un array de proveedores' }, { status: 400 });
    }

    if (proveedores.length > 500) {
      return NextResponse.json({ error: 'Máximo 500 proveedores por importación' }, { status: 400 });
    }

    const { validateCUIT } = await import('@/lib/ventas/cuit-validator');

    // Precargar CUITs y códigos existentes para detección de duplicados eficiente
    const existentes = await prisma.suppliers.findMany({
      where: { company_id: companyId },
      select: { id: true, name: true, cuit: true, codigo: true },
    });
    const cuitExistentes = new Set(
      existentes.filter((e) => e.cuit).map((e) => e.cuit!.replace(/-/g, ''))
    );
    const codigosExistentes = new Set(
      existentes.filter((e) => e.codigo).map((e) => e.codigo!)
    );

    const creados: { id: number; nombre: string }[] = [];
    const omitidos: { nombre: string; razon: string }[] = [];
    const errores: { nombre: string; error: string }[] = [];

    for (const p of proveedores) {
      try {
        const nombre = p.nombre?.trim();
        if (!nombre) {
          omitidos.push({ nombre: p.nombre || '(sin nombre)', razon: 'Nombre requerido' });
          continue;
        }

        const razonSocial = p.razonSocial?.trim() || nombre;

        // Validar y deduplicar código
        const codigo = p.codigo?.trim() || null;
        if (codigo && codigosExistentes.has(codigo)) {
          omitidos.push({ nombre, razon: `Código "${codigo}" ya existe` });
          continue;
        }

        // Validar y deduplicar CUIT
        let formattedCuit: string | null = null;
        if (p.cuit?.trim()) {
          const validation = validateCUIT(p.cuit.trim());
          if (!validation.valid) {
            omitidos.push({ nombre, razon: `CUIT inválido: ${validation.error}` });
            continue;
          }
          formattedCuit = validation.formatted!;
          const cuitNorm = formattedCuit.replace(/-/g, '');
          if (cuitExistentes.has(cuitNorm)) {
            omitidos.push({ nombre, razon: `CUIT ${formattedCuit} ya existe` });
            continue;
          }
          cuitExistentes.add(cuitNorm);
        }

        if (codigo) codigosExistentes.add(codigo);

        const nuevo = await prisma.suppliers.create({
          data: {
            name: nombre,
            razon_social: razonSocial,
            codigo,
            cuit: formattedCuit,
            email: p.email?.trim() || null,
            phone: p.telefono?.trim() || null,
            address: p.direccion?.trim() || null,
            city: p.ciudad?.trim() || null,
            province: p.provincia?.trim() || null,
            postal_code: p.codigoPostal?.trim() || null,
            contact_person: p.contactoNombre?.trim() || null,
            contact_phone: p.contactoTelefono?.trim() || null,
            contact_email: p.contactoEmail?.trim() || null,
            condiciones_pago: p.condicionesPago?.trim() || null,
            condicion_iva: p.condicionIva?.trim() || null,
            ingresos_brutos: p.ingresosBrutos?.trim() || null,
            notes: p.notas?.trim() || null,
            cbu: p.cbu?.trim() || null,
            alias_cbu: p.aliasCbu?.trim() || null,
            banco: p.banco?.trim() || null,
            tipo_cuenta: p.tipoCuenta?.trim() || null,
            numero_cuenta: p.numeroCuenta?.trim() || null,
            company_id: companyId,
          },
        });

        creados.push({ id: nuevo.id, nombre });
      } catch (err: any) {
        errores.push({ nombre: p.nombre || '(sin nombre)', error: err.message || 'Error desconocido' });
      }
    }

    return NextResponse.json(
      {
        creados: creados.length,
        omitidos: omitidos.length,
        errores: errores.length,
        detalle: { creados, omitidos, errores },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error bulk creating proveedores:', error);
    return NextResponse.json({ error: 'Error al importar proveedores' }, { status: 500 });
  }
});
