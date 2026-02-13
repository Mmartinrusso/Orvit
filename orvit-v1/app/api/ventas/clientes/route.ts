import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { createClientSchema } from '@/lib/ventas/validation-schemas';
import {
  getIdempotencyKey,
  withIdempotency,
  handleIdempotencyError,
  idempotencyHeaders,
} from '@/lib/ventas/idempotency-helper';

export const dynamic = 'force-dynamic';

// GET - Listar clientes con filtros y paginación
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CLIENTES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search');
    const active = searchParams.get('active'); // 'true', 'false', or null (all)
    const blocked = searchParams.get('blocked'); // 'true', 'false', or null (all)
    const clientTypeId = searchParams.get('clientTypeId');
    const deliveryZoneId = searchParams.get('deliveryZoneId');
    const sellerId = searchParams.get('sellerId');
    const taxCondition = searchParams.get('taxCondition');
    const sortBy = searchParams.get('sortBy') || 'legalName';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    const includeCredit = searchParams.get('includeCredit') === 'true';

    // Build where clause
    const where: Prisma.ClientWhereInput = {
      companyId,
      ...(active === 'true' && { isActive: true }),
      ...(active === 'false' && { isActive: false }),
      ...(blocked === 'true' && { isBlocked: true }),
      ...(blocked === 'false' && { isBlocked: false }),
      ...(clientTypeId && { clientTypeId }),
      ...(deliveryZoneId && { deliveryZoneId }),
      ...(sellerId && { sellerId: parseInt(sellerId) }),
      ...(taxCondition && { taxCondition }),
      ...(search && {
        OR: [
          { legalName: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { cuit: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { phone: { contains: search, mode: Prisma.QueryMode.insensitive } },
        ]
      }),
    };

    // Build orderBy
    const validSortFields = ['legalName', 'name', 'cuit', 'createdAt', 'currentBalance', 'creditLimit'];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : 'legalName';
    const orderBy: Prisma.ClientOrderByWithRelationInput = {
      [orderByField]: sortOrder === 'desc' ? 'desc' : 'asc'
    };

    const [clientes, total] = await Promise.all([
      prisma.client.findMany({
        where,
        select: {
          id: true,
          legalName: true,
          name: true,
          email: true,
          phone: true,
          cuit: true,
          taxCondition: true,
          creditLimit: true,
          currentBalance: true,
          isActive: true,
          isBlocked: true,
          blockedReason: true,
          city: true,
          province: true,
          paymentTerms: true,
          tipoCondicionVenta: true,
          createdAt: true,
          // Relations
          clientType: { select: { id: true, name: true } },
          deliveryZone: { select: { id: true, name: true } },
          seller: { select: { id: true, name: true } },
          defaultPriceList: { select: { id: true, nombre: true } },
          discountList: { select: { id: true, name: true } },
          // Optional credit info
          ...(includeCredit && {
            _count: {
              select: {
                invoices: { where: { estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] } } },
                payments: { where: { estado: 'CONFIRMADO' } },
              }
            }
          }),
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.client.count({ where })
    ]);

    // Add ML scores to clients
    const clientesWithScores = clientes.map(client => {
      // Calculate simple ML scores
      const creditUtilization = client.creditLimit && Number(client.creditLimit) > 0
        ? (Number(client.currentBalance || 0) / Number(client.creditLimit)) * 100
        : 0;

      // Simple credit score calculation (0-100)
      let creditScore = 70;
      if (creditUtilization < 50) creditScore += 15;
      else if (creditUtilization > 90) creditScore -= 25;
      if (client.isBlocked) creditScore -= 30;
      if (!client.isActive) creditScore -= 20;
      creditScore = Math.max(0, Math.min(100, creditScore));

      // Simple churn risk calculation (0-1)
      let churnRisk = 0.2;
      if (creditUtilization > 95) churnRisk += 0.3;
      if (client.isBlocked) churnRisk += 0.4;
      if (!client.isActive) churnRisk += 0.3;
      churnRisk = Math.max(0, Math.min(1, churnRisk));

      return {
        ...client,
        creditScore,
        churnRisk,
      };
    });

    const response = NextResponse.json({
      data: clientesWithScores, // Keep original key for backwards compatibility
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });

    // Add cache headers
    response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');

    return response;
  } catch (error) {
    console.error('Error fetching clientes:', error);
    return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 });
  }
}

// POST - Crear nuevo cliente
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CLIENTES_CREATE);
    if (error) return error;

    const companyId = user!.companyId;

    // Get idempotency key (optional but recommended)
    const idempotencyKey = getIdempotencyKey(request);

    const body = await request.json();

    // Validate with Zod schema
    const validation = createClientSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Execute with idempotency support
    const idempotencyResult = await withIdempotency(
      idempotencyKey,
      companyId,
      'CREATE_CLIENT',
      async () => {
        // Validate and check CUIT if provided
        let formattedCuit: string | null = null;
        if (data.cuit) {
          // Validate CUIT using comprehensive validator (check digit algorithm)
          const { validateCUIT } = await import('@/lib/ventas/cuit-validator');
          const cuitValidation = validateCUIT(data.cuit);

          if (!cuitValidation.valid) {
            throw new Error(`INVALID_CUIT:${cuitValidation.error}`);
          }

          formattedCuit = cuitValidation.formatted!;

          // Check for duplicate CUIT (use cleaned version)
          const cleanCuit = formattedCuit.replace(/[-\s]/g, '');
          const existingCuit = await prisma.client.findFirst({
            where: {
              companyId,
              cuit: { in: [formattedCuit, cleanCuit, data.cuit] }
            }
          });
          if (existingCuit) {
            throw new Error('DUPLICATE_CUIT');
          }
        }

        // Check for duplicate email
        const existingEmail = await prisma.client.findFirst({
          where: { companyId, email: data.email }
        });
        if (existingEmail) {
          throw new Error('DUPLICATE_EMAIL');
        }

        const cliente = await prisma.client.create({
          data: {
            legalName: data.legalName,
            email: data.email,
            postalCode: data.postalCode,
            name: data.name || null,
            phone: data.phone || null,
            alternatePhone: data.alternatePhone || null,
            address: data.address || null,
            city: data.city || null,
            province: data.province || null,
            cuit: formattedCuit || data.cuit || null,
            taxCondition: data.taxCondition,
            observations: data.observations || null,
            contactPerson: data.contactPerson || null,
            creditLimit: data.creditLimit ?? null,
            paymentTerms: data.paymentTerms,
            checkTerms: data.checkTerms ?? null,
            invoiceDueDays: data.invoiceDueDays,
            clientTypeId: data.clientTypeId || null,
            deliveryZoneId: data.deliveryZoneId || null,
            sellerId: data.sellerId ?? null,
            defaultPriceListId: data.priceListId || data.defaultPriceListId || null,
            discountListId: data.discountListId || null,
            tipoCondicionVenta: data.tipoCondicionVenta,
            porcentajeFormal: data.porcentajeFormal ?? null,
            saleCondition: data.saleCondition || null,
            limiteAcopio: data.limiteAcopio ?? null,
            diasAlertaAcopio: data.diasAlertaAcopio ?? null,
            hasCheckLimit: data.hasCheckLimit,
            checkLimitType: data.checkLimitType || null,
            checkLimit: data.checkLimit ?? null,
            settlementPeriod: data.settlementPeriod || null,
            requiresPurchaseOrder: data.requiresPurchaseOrder,
            grossIncome: data.grossIncome || null,
            activityStartDate: data.activityStartDate ? new Date(data.activityStartDate) : null,
            merchandisePendingDays: data.merchandisePendingDays ?? null,
            accountBlockDays: data.accountBlockDays ?? null,
            extraBonusDescription: data.extraBonusDescription || null,
            transportCompanyId: data.transportCompanyId || null,
            businessSectorId: data.businessSectorId || null,
            quickNote: data.quickNote || null,
            quickNoteExpiry: data.quickNoteExpiry ? new Date(data.quickNoteExpiry) : null,
            companyId,
            isActive: true,
            isBlocked: false,
            currentBalance: 0,
            acopioActual: 0,
          },
          include: {
            clientType: { select: { id: true, name: true } },
            deliveryZone: { select: { id: true, name: true } },
            seller: { select: { id: true, name: true } },
            defaultPriceList: { select: { id: true, nombre: true } },
            discountList: { select: { id: true, name: true } },
          }
        });

        return cliente;
      },
      {
        entityType: 'Client',
        getEntityId: (result) => parseInt(result.id) || 0,
      }
    );

    return NextResponse.json(idempotencyResult.response, {
      status: idempotencyResult.isReplay ? 200 : 201,
      headers: idempotencyHeaders(idempotencyResult.idempotencyKey, idempotencyResult.isReplay),
    });
  } catch (error) {
    console.error('Error creating cliente:', error);

    // Handle idempotency conflict error
    const idempotencyError = handleIdempotencyError(error);
    if (idempotencyError) return idempotencyError;

    // Handle custom error messages
    if (error instanceof Error) {
      if (error.message.startsWith('INVALID_CUIT:')) {
        const cuitError = error.message.split(':').slice(1).join(':');
        return NextResponse.json({
          error: 'CUIT inválido',
          details: cuitError,
        }, { status: 400 });
      }
      if (error.message === 'DUPLICATE_CUIT') {
        return NextResponse.json({ error: 'Ya existe un cliente con ese CUIT' }, { status: 400 });
      }
      if (error.message === 'DUPLICATE_EMAIL') {
        return NextResponse.json({ error: 'Ya existe un cliente con ese email' }, { status: 400 });
      }
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: error.errors },
        { status: 400 }
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json({ error: 'Ya existe un cliente con datos duplicados' }, { status: 400 });
      }
    }
    return NextResponse.json({ error: 'Error al crear cliente' }, { status: 500 });
  }
}
