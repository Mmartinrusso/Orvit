import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CreateProductSchema } from '@/lib/validations/costs';
import { withGuards } from '@/lib/middleware/withGuards';
import { validateRequest } from '@/lib/validations/helpers';
import { cached, invalidateCache } from '@/lib/cache/cache-manager';
import { costProductKeys, invalidationPatterns, TTL } from '@/lib/cache/cache-keys';

export const dynamic = 'force-dynamic';


export const GET = withGuards(async (request: NextRequest, { user }) => {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';
    const cacheKey = costProductKeys.list(user.companyId, activeOnly || undefined);

    const products = await cached(cacheKey, async () => {
      return prisma.costProduct.findMany({
        where: {
          companyId: user.companyId,
          ...(activeOnly && { active: true }),
        },
        include: {
          line: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });
    }, TTL.MEDIUM);

    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
});

export const POST = withGuards(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const validation = validateRequest(CreateProductSchema, body);
    if (!validation.success) return validation.response;

    const product = await prisma.costProduct.create({
      data: validation.data,
      include: {
        line: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    // Invalidar cache de cost products
    await invalidateCache(invalidationPatterns.products(user.companyId));

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
});
