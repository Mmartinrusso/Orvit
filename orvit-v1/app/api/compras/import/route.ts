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

interface ImportRow {
  rowNumber: number;
  data: Record<string, any>;
  errors: string[];
  warnings: string[];
  valid: boolean;
}

interface ImportResult {
  success: boolean;
  imported: number;
  errors: number;
  warnings: number;
  details: ImportRow[];
}

// Parsear CSV básico
function parseCSV(content: string): Record<string, any>[] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  // Detectar separador (coma, punto y coma, tab)
  const firstLine = lines[0];
  let separator = ',';
  if (firstLine.includes(';') && !firstLine.includes(',')) {
    separator = ';';
  } else if (firstLine.includes('\t')) {
    separator = '\t';
  }

  const headers = lines[0].split(separator).map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
  const rows: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(separator).map(v => v.trim().replace(/^["']|["']$/g, ''));
    const row: Record<string, any> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    rows.push(row);
  }

  return rows;
}

// Normalizar nombres de columnas
function normalizeColumnName(name: string): string {
  const mappings: Record<string, string[]> = {
    'proveedor': ['proveedor', 'supplier', 'vendor', 'nombre_proveedor', 'razon_social'],
    'cuit': ['cuit', 'cuit/cuil', 'cuil', 'tax_id', 'rut'],
    'numero_factura': ['numero_factura', 'factura', 'invoice', 'nro_factura', 'numero', 'n_factura'],
    'punto_venta': ['punto_venta', 'pv', 'sucursal', 'pos'],
    'fecha': ['fecha', 'date', 'fecha_emision', 'fecha_factura'],
    'monto_total': ['monto_total', 'total', 'amount', 'importe', 'monto'],
    'neto': ['neto', 'subtotal', 'net', 'gravado'],
    'iva': ['iva', 'iva21', 'impuesto', 'tax'],
    'descripcion': ['descripcion', 'description', 'concepto', 'detalle'],
    'cantidad': ['cantidad', 'qty', 'quantity', 'cant'],
    'precio': ['precio', 'price', 'precio_unitario', 'p_unit'],
    'codigo': ['codigo', 'code', 'sku', 'cod'],
    'email': ['email', 'correo', 'mail'],
    'telefono': ['telefono', 'phone', 'tel'],
    'direccion': ['direccion', 'address', 'domicilio'],
  };

  const normalizedName = name.toLowerCase().trim().replace(/\s+/g, '_');

  for (const [key, aliases] of Object.entries(mappings)) {
    if (aliases.includes(normalizedName)) {
      return key;
    }
  }

  return normalizedName;
}

// Validar y procesar importación de proveedores
async function processSupplierImport(
  rows: Record<string, any>[],
  companyId: number,
  preview: boolean
): Promise<ImportResult> {
  const results: ImportRow[] = [];
  let imported = 0;
  let errors = 0;
  let warnings = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const normalized: Record<string, any> = {};

    // Normalizar columnas
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeColumnName(key)] = value;
    }

    const rowResult: ImportRow = {
      rowNumber: i + 2, // +2 porque empezamos en 1 y hay header
      data: normalized,
      errors: [],
      warnings: [],
      valid: true
    };

    // Validaciones
    if (!normalized.proveedor) {
      rowResult.errors.push('Nombre del proveedor es requerido');
      rowResult.valid = false;
    }

    if (!normalized.cuit) {
      rowResult.warnings.push('CUIT no especificado');
      warnings++;
    } else {
      // Validar formato CUIT (básico)
      const cuitLimpio = normalized.cuit.replace(/[-\s]/g, '');
      if (!/^\d{11}$/.test(cuitLimpio)) {
        rowResult.errors.push('CUIT inválido (debe tener 11 dígitos)');
        rowResult.valid = false;
      }
    }

    if (normalized.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) {
      rowResult.warnings.push('Email con formato inválido');
      warnings++;
    }

    // Verificar duplicado
    if (normalized.cuit && rowResult.valid) {
      const existente = await prisma.suppliers.findFirst({
        where: {
          companyId,
          cuit: normalized.cuit.replace(/[-\s]/g, '')
        }
      });

      if (existente) {
        rowResult.warnings.push(`Proveedor con CUIT ${normalized.cuit} ya existe (ID: ${existente.id})`);
        warnings++;
      }
    }

    if (!rowResult.valid) {
      errors++;
    }

    results.push(rowResult);

    // Si no es preview y es válido, crear
    if (!preview && rowResult.valid) {
      try {
        await prisma.suppliers.create({
          data: {
            name: normalized.proveedor,
            cuit: normalized.cuit?.replace(/[-\s]/g, '') || null,
            razon_social: normalized.razon_social || normalized.proveedor,
            email: normalized.email || null,
            phone: normalized.telefono || null,
            address: normalized.direccion || null,
            companyId
          }
        });
        imported++;
      } catch (err: any) {
        rowResult.errors.push(`Error al crear: ${err.message}`);
        errors++;
      }
    }
  }

  return {
    success: errors === 0,
    imported,
    errors,
    warnings,
    details: results
  };
}

// Validar y procesar importación de facturas
async function processInvoiceImport(
  rows: Record<string, any>[],
  companyId: number,
  userId: number,
  preview: boolean
): Promise<ImportResult> {
  const results: ImportRow[] = [];
  let imported = 0;
  let errors = 0;
  let warnings = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const normalized: Record<string, any> = {};

    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeColumnName(key)] = value;
    }

    const rowResult: ImportRow = {
      rowNumber: i + 2,
      data: normalized,
      errors: [],
      warnings: [],
      valid: true
    };

    // Validaciones
    if (!normalized.numero_factura) {
      rowResult.errors.push('Número de factura es requerido');
      rowResult.valid = false;
    }

    if (!normalized.proveedor && !normalized.cuit) {
      rowResult.errors.push('Proveedor o CUIT es requerido');
      rowResult.valid = false;
    }

    if (!normalized.monto_total) {
      rowResult.errors.push('Monto total es requerido');
      rowResult.valid = false;
    } else {
      const monto = parseFloat(normalized.monto_total.toString().replace(/[,$]/g, ''));
      if (isNaN(monto) || monto <= 0) {
        rowResult.errors.push('Monto total inválido');
        rowResult.valid = false;
      }
    }

    if (!normalized.fecha) {
      rowResult.warnings.push('Fecha no especificada, se usará fecha actual');
      warnings++;
    }

    // Buscar proveedor
    let supplierId: number | null = null;
    if (rowResult.valid) {
      const proveedor = await prisma.suppliers.findFirst({
        where: {
          companyId,
          OR: [
            normalized.cuit ? { cuit: normalized.cuit.replace(/[-\s]/g, '') } : {},
            normalized.proveedor ? { name: { contains: normalized.proveedor, mode: 'insensitive' } } : {}
          ].filter(o => Object.keys(o).length > 0)
        }
      });

      if (proveedor) {
        supplierId = proveedor.id;
      } else {
        rowResult.errors.push('Proveedor no encontrado en el sistema');
        rowResult.valid = false;
      }
    }

    // Verificar duplicado
    if (normalized.numero_factura && supplierId) {
      const existente = await prisma.purchaseReceipt.findFirst({
        where: {
          companyId,
          supplierId,
          numero_factura: normalized.numero_factura.trim()
        }
      });

      if (existente) {
        rowResult.warnings.push('Posible duplicado detectado');
        warnings++;
      }
    }

    if (!rowResult.valid) {
      errors++;
    }

    results.push(rowResult);

    // Si no es preview y es válido, crear
    if (!preview && rowResult.valid && supplierId) {
      try {
        const monto = parseFloat(normalized.monto_total.toString().replace(/[,$]/g, ''));
        const neto = normalized.neto ? parseFloat(normalized.neto.toString().replace(/[,$]/g, '')) : monto / 1.21;
        const iva = normalized.iva ? parseFloat(normalized.iva.toString().replace(/[,$]/g, '')) : monto - neto;

        // Parsear fecha
        let fecha = new Date();
        if (normalized.fecha) {
          const fechaStr = normalized.fecha.toString();
          // Intentar varios formatos
          const fechaParsed = new Date(fechaStr);
          if (!isNaN(fechaParsed.getTime())) {
            fecha = fechaParsed;
          }
        }

        await prisma.purchaseReceipt.create({
          data: {
            numero_factura: normalized.numero_factura.trim(),
            punto_venta: normalized.punto_venta?.toString().padStart(5, '0') || '00001',
            tipo_comprobante: 'FACTURA_A',
            fecha,
            monto_total: monto,
            monto_neto: neto,
            monto_iva: iva,
            estado: 'pendiente',
            supplierId,
            companyId,
            userId
          }
        });
        imported++;
      } catch (err: any) {
        rowResult.errors.push(`Error al crear: ${err.message}`);
        errors++;
      }
    }
  }

  return {
    success: errors === 0,
    imported,
    errors,
    warnings,
    details: results
  };
}

// POST - Importar datos
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

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const tipo = formData.get('tipo') as string; // 'proveedores', 'facturas', 'ordenes'
    const preview = formData.get('preview') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'Archivo es requerido' }, { status: 400 });
    }

    if (!tipo || !['proveedores', 'facturas', 'ordenes'].includes(tipo)) {
      return NextResponse.json(
        { error: 'Tipo debe ser: proveedores, facturas u ordenes' },
        { status: 400 }
      );
    }

    // Leer contenido del archivo
    const content = await file.text();
    const rows = parseCSV(content);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'El archivo está vacío o tiene formato incorrecto' },
        { status: 400 }
      );
    }

    let result: ImportResult;

    switch (tipo) {
      case 'proveedores':
        result = await processSupplierImport(rows, companyId, preview);
        break;

      case 'facturas':
        result = await processInvoiceImport(rows, companyId, user.id, preview);
        break;

      case 'ordenes':
        // Similar a facturas pero para órdenes de compra
        return NextResponse.json(
          { error: 'Importación de órdenes en desarrollo' },
          { status: 501 }
        );

      default:
        return NextResponse.json({ error: 'Tipo no soportado' }, { status: 400 });
    }

    // Registrar en auditoría si no es preview
    if (!preview) {
      await prisma.purchaseAuditLog.create({
        data: {
          entidad: `import_${tipo}`,
          entidadId: 0,
          accion: 'IMPORT_MASIVO',
          datosNuevos: {
            archivo: file.name,
            filas: rows.length,
            importadas: result.imported,
            errores: result.errors
          },
          companyId,
          userId: user.id
        }
      });
    }

    return NextResponse.json({
      preview,
      tipo,
      archivo: file.name,
      totalFilas: rows.length,
      ...result
    });
  } catch (error: any) {
    console.error('Error en importación:', error);
    return NextResponse.json(
      { error: error.message || 'Error al procesar la importación' },
      { status: 500 }
    );
  }
}

// GET - Obtener plantillas de ejemplo
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get('tipo');

  const templates: Record<string, string> = {
    proveedores: `proveedor,cuit,razon_social,email,telefono,direccion
"Proveedor ABC","20-12345678-9","ABC S.A.","contacto@abc.com","011-4444-5555","Av. Corrientes 1234, CABA"
"Distribuidora XYZ","30-98765432-1","XYZ SRL","ventas@xyz.com","011-2222-3333","Av. Rivadavia 5678, CABA"`,

    facturas: `numero_factura,punto_venta,proveedor,cuit,fecha,monto_total,neto,iva
"00001234","00001","Proveedor ABC","20-12345678-9","2025-01-15","12100.00","10000.00","2100.00"
"00005678","00002","Distribuidora XYZ","30-98765432-1","2025-01-16","24200.00","20000.00","4200.00"`,

    ordenes: `numero,proveedor,fecha,total,items
"OC-2025-00001","Proveedor ABC","2025-01-10","15000.00","Producto A x10, Producto B x5"`
  };

  if (tipo && templates[tipo]) {
    return new NextResponse(templates[tipo], {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=plantilla_${tipo}.csv`
      }
    });
  }

  return NextResponse.json({
    templates: Object.keys(templates),
    descripcion: {
      proveedores: 'Columnas: proveedor, cuit, razon_social, email, telefono, direccion',
      facturas: 'Columnas: numero_factura, punto_venta, proveedor/cuit, fecha, monto_total, neto, iva',
      ordenes: 'Columnas: numero, proveedor, fecha, total, items'
    }
  });
}
