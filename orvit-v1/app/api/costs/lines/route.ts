import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CreateLineSchema } from '@/lib/validations/costs';
import { withGuards } from '@/lib/middleware/withGuards';
import { validateRequest } from '@/lib/validations/helpers';

export const dynamic = 'force-dynamic';


export const GET = withGuards(async (_request: NextRequest, { user }) => {
  try {
    const lines = await prisma.line.findMany({
      where: {
        companyId: user.companyId,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(lines);
  } catch (error) {
    console.error('Error fetching lines:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
});

export const POST = withGuards(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const validation = validateRequest(CreateLineSchema, body);
    if (!validation.success) return validation.response;

    // Check if line with same code already exists in the same company
    const existingLine = await prisma.line.findFirst({
      where: {
        code: validation.data.code,
        companyId: user.companyId,
      },
    });

    if (existingLine) {
      return NextResponse.json(
        { error: 'Ya existe una línea con ese código' },
        { status: 400 }
      );
    }

    const line = await prisma.line.create({
      data: {
        ...validation.data,
        companyId: user.companyId,
      },
    });

    return NextResponse.json(line, { status: 201 });
  } catch (error) {
    console.error('Error creating line:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
});
