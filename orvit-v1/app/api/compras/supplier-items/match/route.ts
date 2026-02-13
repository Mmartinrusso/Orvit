import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

export const dynamic = 'force-dynamic';

// Buscar matches de items por nombre/código del proveedor
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    const companyId = payload.companyId as number;
    if (!companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const body = await req.json();
    const { supplierId, items } = body as {
      supplierId: number;
      items: Array<{
        codigo?: string;
        descripcion: string;
        cantidad: number;
        precio_unitario: number;
      }>;
    };

    if (!supplierId || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'supplierId e items son requeridos' },
        { status: 400 }
      );
    }

    const results = [];

    for (const item of items) {
      let match = null;
      let matchType: 'exact_alias' | 'exact_code' | 'fuzzy' | 'none' = 'none';
      let suggestions: any[] = [];

      // 1. Buscar por alias exacto (nombre en factura)
      if (item.descripcion) {
        const aliasMatch = await prisma.supplierItemAlias.findFirst({
          where: {
            companyId,
            alias: {
              equals: item.descripcion,
              mode: 'insensitive',
            },
            supplierItem: {
              supplierId,
              activo: true,
            },
          },
          include: {
            supplierItem: {
              include: {
                supply: true,
              },
            },
          },
        });

        if (aliasMatch) {
          match = {
            supplierItemId: aliasMatch.supplierItemId,
            nombre: aliasMatch.supplierItem.nombre,
            supplyId: aliasMatch.supplierItem.supplyId,
            supplyName: aliasMatch.supplierItem.supply.name,
            aliasId: aliasMatch.id,
          };
          matchType = 'exact_alias';

          // Incrementar contador de uso
          await prisma.supplierItemAlias.update({
            where: { id: aliasMatch.id },
            data: { vecesUsado: { increment: 1 } },
          });
        }
      }

      // 2. Si no hay match por alias, buscar por código del proveedor
      if (!match && item.codigo) {
        const codeMatch = await prisma.supplierItem.findFirst({
          where: {
            supplierId,
            companyId,
            activo: true,
            codigoProveedor: {
              equals: item.codigo,
              mode: 'insensitive',
            },
          },
          include: {
            supply: true,
          },
        });

        if (codeMatch) {
          match = {
            supplierItemId: codeMatch.id,
            nombre: codeMatch.nombre,
            supplyId: codeMatch.supplyId,
            supplyName: codeMatch.supply.name,
          };
          matchType = 'exact_code';
        }
      }

      // 3. Si no hay match exacto, buscar sugerencias por similitud
      if (!match) {
        // Buscar por nombre similar en SupplierItem
        const similarItems = await prisma.supplierItem.findMany({
          where: {
            supplierId,
            companyId,
            activo: true,
            OR: [
              {
                nombre: {
                  contains: item.descripcion.split(' ')[0], // Primera palabra
                  mode: 'insensitive',
                },
              },
              {
                aliases: {
                  some: {
                    alias: {
                      contains: item.descripcion.split(' ')[0],
                      mode: 'insensitive',
                    },
                  },
                },
              },
            ],
          },
          include: {
            supply: true,
            aliases: true,
          },
          take: 5,
        });

        suggestions = similarItems.map((si) => ({
          supplierItemId: si.id,
          nombre: si.nombre,
          codigoProveedor: si.codigoProveedor,
          supplyId: si.supplyId,
          supplyName: si.supply.name,
          aliases: si.aliases.map((a) => a.alias),
          similarity: calculateSimilarity(item.descripcion, si.nombre),
        }));

        // Ordenar por similitud
        suggestions.sort((a, b) => b.similarity - a.similarity);

        // Si hay una sugerencia con alta similitud (>80%), marcarla como fuzzy match
        if (suggestions.length > 0 && suggestions[0].similarity > 0.8) {
          matchType = 'fuzzy';
        }
      }

      results.push({
        originalItem: item,
        match,
        matchType,
        suggestions: match ? [] : suggestions,
      });
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: items.length,
        matched: results.filter((r) => r.match).length,
        needsMapping: results.filter((r) => !r.match).length,
      },
    });
  } catch (error: any) {
    console.error('Error matching items:', error);
    return NextResponse.json(
      { error: error.message || 'Error al buscar matches' },
      { status: 500 }
    );
  }
}

// Calcular similitud entre dos strings (Dice coefficient simplificado)
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;

  // Crear bigramas
  const bigrams1 = new Set<string>();
  const bigrams2 = new Set<string>();

  for (let i = 0; i < s1.length - 1; i++) {
    bigrams1.add(s1.substring(i, i + 2));
  }
  for (let i = 0; i < s2.length - 1; i++) {
    bigrams2.add(s2.substring(i, i + 2));
  }

  // Contar intersección
  let intersection = 0;
  bigrams1.forEach((bigram) => {
    if (bigrams2.has(bigram)) intersection++;
  });

  return (2 * intersection) / (bigrams1.size + bigrams2.size);
}
