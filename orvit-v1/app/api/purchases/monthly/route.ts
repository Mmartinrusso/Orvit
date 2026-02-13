import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';


const toMonthKey = (year: number, month: number) =>
  `${year}-${month.toString().padStart(2, '0')}`;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyIdParam = searchParams.get('companyId');
    const yearParam = searchParams.get('year');

    if (!companyIdParam) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    const companyId = parseInt(companyIdParam, 10);
    if (Number.isNaN(companyId)) {
      return NextResponse.json(
        { error: 'companyId inválido' },
        { status: 400 }
      );
    }

    const year = yearParam ? parseInt(yearParam, 10) : undefined;

    const purchases = await prisma.factPurchasesMonthly.findMany({
      where: {
        companyId,
        ...(year
          ? {
              month: {
                startsWith: `${year}-`
              }
            }
          : {})
      },
      orderBy: {
        month: 'asc'
      }
    });

    const formatted = purchases.map(purchase => ({
      month: purchase.month,
      amount: parseFloat(purchase.amount.toString()),
      createdAt: purchase.createdAt
    }));

    return NextResponse.json({
      purchases: formatted
    });
  } catch (error) {
    console.error('❌ Error fetching monthly purchases:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, year, month, amount } = body;

    if (
      companyId === undefined ||
      year === undefined ||
      month === undefined ||
      amount === undefined
    ) {
      return NextResponse.json(
        { error: 'companyId, year, month y amount son requeridos' },
        { status: 400 }
      );
    }

    const numericCompanyId = parseInt(companyId, 10);
    const numericYear = parseInt(year, 10);
    const numericMonth = parseInt(month, 10);
    const numericAmount = Number(amount);

    if (
      Number.isNaN(numericCompanyId) ||
      Number.isNaN(numericYear) ||
      Number.isNaN(numericMonth) ||
      Number.isNaN(numericAmount)
    ) {
      return NextResponse.json(
        { error: 'Parámetros inválidos' },
        { status: 400 }
      );
    }

    const monthKey = toMonthKey(numericYear, numericMonth);

    const purchase = await prisma.factPurchasesMonthly.upsert({
      where: {
        companyId_month: {
          companyId: numericCompanyId,
          month: monthKey
        }
      },
      update: {
        amount: numericAmount
      },
      create: {
        id: crypto.randomUUID(),
        companyId: numericCompanyId,
        month: monthKey,
        amount: numericAmount
      }
    });

    return NextResponse.json({
      success: true,
      purchase: {
        month: purchase.month,
        amount: parseFloat(purchase.amount.toString())
      }
    });
  } catch (error) {
    console.error('❌ Error saving monthly purchase:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, year, month } = body;

    if (
      companyId === undefined ||
      year === undefined ||
      month === undefined
    ) {
      return NextResponse.json(
        { error: 'companyId, year y month son requeridos' },
        { status: 400 }
      );
    }

    const numericCompanyId = parseInt(companyId, 10);
    const numericYear = parseInt(year, 10);
    const numericMonth = parseInt(month, 10);

    if (
      Number.isNaN(numericCompanyId) ||
      Number.isNaN(numericYear) ||
      Number.isNaN(numericMonth)
    ) {
      return NextResponse.json(
        { error: 'Parámetros inválidos' },
        { status: 400 }
      );
    }

    const monthKey = toMonthKey(numericYear, numericMonth);

    await prisma.factPurchasesMonthly.deleteMany({
      where: {
        companyId: numericCompanyId,
        month: monthKey
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting monthly purchase:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

