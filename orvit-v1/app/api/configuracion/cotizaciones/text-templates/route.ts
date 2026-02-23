import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const TIPOS_VALIDOS = ['NOTA', 'PAGO', 'ENTREGA'] as const;

const textTemplateSchema = z.object({
  tipo: z.enum(TIPOS_VALIDOS),
  nombre: z.string().min(1).max(100),
  contenido: z.string().min(1),
  isDefault: z.boolean().optional().default(false),
  orden: z.number().int().optional().default(0),
});

// GET - Listar plantillas de texto de la empresa
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo');

    const templates = await (prisma as any).quoteTextTemplate.findMany({
      where: {
        companyId: user.companyId,
        ...(tipo && TIPOS_VALIDOS.includes(tipo as any) ? { tipo } : {}),
      },
      orderBy: [{ tipo: 'asc' }, { orden: 'asc' }, { nombre: 'asc' }],
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error fetching text templates:', error);
    return NextResponse.json({ error: 'Error al obtener plantillas' }, { status: 500 });
  }
}

// POST - Crear plantilla de texto
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await request.json();
    const validation = textTemplateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { tipo, nombre, contenido, isDefault, orden } = validation.data;

    const template = await (prisma as any).quoteTextTemplate.create({
      data: {
        companyId: user.companyId,
        tipo,
        nombre,
        contenido,
        isDefault,
        orden,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Error creating text template:', error);
    return NextResponse.json({ error: 'Error al crear plantilla' }, { status: 500 });
  }
}
