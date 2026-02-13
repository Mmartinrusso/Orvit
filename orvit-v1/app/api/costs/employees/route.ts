import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CreateEmployeeSchema } from '@/lib/validations/costs';
import { withGuards } from '@/lib/middleware/withGuards';
import { validateRequest } from '@/lib/validations/helpers';

export const dynamic = 'force-dynamic';


export const GET = withGuards(async (_request: NextRequest, { user }) => {
  try {
    const employees = await prisma.costEmployee.findMany({
      where: {
        companyId: user.companyId,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
});

export const POST = withGuards(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const validation = validateRequest(CreateEmployeeSchema, body);
    if (!validation.success) return validation.response;

    const employee = await prisma.costEmployee.create({
      data: {
        ...validation.data,
        companyId: user.companyId,
      },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
});
