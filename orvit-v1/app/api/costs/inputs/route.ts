import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CreateInputItemSchema } from '@/lib/validations/costs';
import { withGuards } from '@/lib/middleware/withGuards';
import { validateRequest } from '@/lib/validations/helpers';

export const dynamic = 'force-dynamic';


export const GET = withGuards(async (_request: NextRequest, { user }) => {
  try {
    const inputs = await prisma.inputItem.findMany({
      where: {
        companyId: user.companyId,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(inputs);
  } catch (error) {
    console.error('Error fetching input items:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
});

export const POST = withGuards(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const validation = validateRequest(CreateInputItemSchema, body);
    if (!validation.success) return validation.response;

    const inputItem = await prisma.inputItem.create({
      data: {
        ...validation.data,
        companyId: user.companyId,
      },
    });

    return NextResponse.json(inputItem, { status: 201 });
  } catch (error) {
    console.error('Error creating input item:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
});
