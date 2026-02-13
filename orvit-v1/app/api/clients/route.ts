import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret
import { getStringParam, getBoolParam, getPaginationParams } from '@/lib/api-utils';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper para obtener usuario desde JWT
async function getUserFromToken(request: NextRequest) {
  try {
    const token = cookies().get('token')?.value;
    
    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: {
            company: true
          }
        }
      }
    });

    if (!user || !user.companies || user.companies.length === 0) {
      return null;
    }

    return {
      userId: user.id,
      companyId: user.companies[0].companyId,
    };
  } catch (error) {
    console.error('Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

// GET - Obtener clientes de la empresa (paginado)
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserFromToken(request);
    if (!auth || !auth.userId || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Leer parámetros de paginación y búsqueda
    const { searchParams } = new URL(request.url);
    const { page, pageSize: limit, skip } = getPaginationParams(searchParams, {
      defaultPageSize: 50,
      maxPageSize: 200,
      pageSizeParam: 'limit',
    });
    const search = getStringParam(searchParams, 'search') || '';
    const minimal = getBoolParam(searchParams, 'minimal', false) ?? false;

    try {
      // Verificar primero si el modelo existe antes de intentar usarlo
      const hasClientModel = prisma.client && typeof (prisma.client as any).findMany === 'function';

      if (!hasClientModel) {
        console.log('Modelo Client no disponible en Prisma Client, usando consulta raw');
        // Ir directamente a SQL raw - no hacer return aquí, continuar al bloque de SQL raw
      } else {
        // Intentar usar el modelo de Prisma si está disponible
        try {
          const where: any = {
            companyId: auth.companyId,
            isActive: true,
          };

          if (search) {
            where.OR = [
              { legalName: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
              { cuit: { contains: search, mode: 'insensitive' } },
            ];
          }

          // Modo minimal: solo id, legalName, name (para selectores)
          if (minimal) {
            const [clients, total] = await Promise.all([
              prisma.client.findMany({
                where,
                select: { id: true, legalName: true, name: true },
                orderBy: { legalName: 'asc' },
                skip,
                take: limit,
              }),
              prisma.client.count({ where }),
            ]);

            return NextResponse.json({
              data: clients || [],
              pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            });
          }

          const [clients, total] = await Promise.all([
            prisma.client.findMany({
              where,
              include: {
                discounts: {
                  where: { isActive: true },
                },
                priceLists: {
                  where: { isActive: true },
                },
                clientType: true,
                deliveryZone: true,
                seller: { select: { id: true, name: true } },
              },
              orderBy: {
                legalName: 'asc',
              },
              skip,
              take: limit,
            }),
            prisma.client.count({ where }),
          ]);

          return NextResponse.json({
            data: clients || [],
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
          });
        } catch (prismaError: any) {
          // Si el modelo no está disponible, usar consulta raw
          console.log('Error con modelo Prisma:', prismaError.message);
          if (prismaError.code === 'P2021' || prismaError.code === 'P2001' ||
              prismaError.message?.includes('does not exist') ||
              prismaError.message?.includes('Unknown model') ||
              prismaError.message?.includes('model Client')) {
            console.log('Modelo Client no disponible, usando consulta raw');
            // Continuar al bloque de SQL raw
          } else {
            throw prismaError;
          }
        }
      }

      // Si llegamos aquí, usar consulta raw (ya sea porque el modelo no existe o porque falló)
      try {
            console.log('🔍 Buscando clientes para companyId:', auth.companyId, 'tipo:', typeof auth.companyId);
            // Asegurarse de que companyId sea un número
            const companyIdNum = parseInt(auth.companyId.toString(), 10);

            // Construir condición de búsqueda con Prisma.sql
            const searchFilter = search
              ? Prisma.sql`AND (c."legalName" ILIKE ${'%' + search + '%'} OR c.name ILIKE ${'%' + search + '%'} OR c.cuit ILIKE ${'%' + search + '%'})`
              : Prisma.empty;

            // Modo minimal para selectores
            if (minimal) {
              const clientsMinimal = await prisma.$queryRaw`
                SELECT c.id, c."legalName", c.name
                FROM "Client" c
                WHERE c."companyId" = ${companyIdNum}
                  AND c."isActive" = true
                  ${searchFilter}
                ORDER BY c."legalName" ASC
                LIMIT ${limit} OFFSET ${skip}
              ` as any[];

              const countResult = await prisma.$queryRaw`
                SELECT COUNT(*)::int as total
                FROM "Client" c
                WHERE c."companyId" = ${companyIdNum}
                  AND c."isActive" = true
                  ${searchFilter}
              ` as any[];

              const total = countResult[0]?.total || 0;

              return NextResponse.json({
                data: clientsMinimal || [],
                pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
              });
            }

            // Consulta paginada con búsqueda
            const clientsRaw = await prisma.$queryRaw`
              SELECT
                c.id,
                c."legalName",
                c.name,
                c.email,
                c.phone,
                c."alternatePhone",
                c.address,
                c.city,
                c.province,
                c."postalCode",
                c.cuit,
                c."taxCondition",
                c."creditLimit",
                c."currentBalance",
                c."paymentTerms",
                c."checkTerms",
                c."saleCondition",
                c."contactPerson",
                c."merchandisePendingDays",
                c."grossIncome",
                c."activityStartDate",
                c."sellerId",
                c."clientTypeId",
                c."deliveryZoneId",
                c."isActive",
                c."isBlocked",
                c."blockedReason",
                c."blockedAt",
                c."companyId",
                c.observations,
                c."tipoCondicionVenta",
                c."porcentajeFormal",
                c."createdAt",
                c."updatedAt",
                c."transportCompanyId",
                c."businessSectorId",
                c."settlementPeriod",
                c."requiresPurchaseOrder",
                c."isDeliveryBlocked",
                c."deliveryBlockedReason",
                c."deliveryBlockedAt",
                c."quickNote",
                c."quickNoteExpiry",
                c."hasCheckLimit",
                c."checkLimitType",
                c."checkLimit",
                c."generalDiscount",
                c."creditLimitOverride",
                c."creditLimitOverrideExpiry",
                c."merchandisePendingDaysOverride",
                c."merchandisePendingDaysOverrideExpiry",
                c."tempCreditLimit",
                c."tempCreditLimitOverride",
                c."tempCreditLimitOverrideExpiry",
                c."invoiceDueDays",
                c."accountBlockDays",
                c."extraBonusDescription",
                c."discountListId",
                c."defaultPriceListId",
                c.whatsapp,
                c."municipalRetentionType",
                c."parentClientId",
                c."visitDays",
                c."deliveryDays",
                c."isVatPerceptionExempt",
                c."vatPerceptionExemptUntil",
                c."vatPerceptionExemptCertificate",
                c."isVatRetentionExempt",
                c."vatRetentionExemptUntil",
                c."isGrossIncomeExempt",
                c."grossIncomeExemptUntil",
                c."isMunicipalExempt",
                c."municipalExemptUntil"
              FROM "Client" c
              WHERE c."companyId" = ${companyIdNum}
                AND c."isActive" = true
                ${searchFilter}
              ORDER BY c."legalName" ASC
              LIMIT ${limit} OFFSET ${skip}
            ` as any[];

            // Count total
            const countResult = await prisma.$queryRaw`
              SELECT COUNT(*)::int as total
              FROM "Client" c
              WHERE c."companyId" = ${companyIdNum}
                AND c."isActive" = true
                ${searchFilter}
            ` as any[];

            const total = countResult[0]?.total || 0;

            // Obtener descuentos y listas de precios por separado
            const clients = await Promise.all(
              (clientsRaw || []).map(async (c: any) => {
                try {
                  const discounts = await prisma.$queryRaw`
                    SELECT * FROM "ClientDiscount"
                    WHERE "clientId" = ${c.id} AND "isActive" = true
                  ` as any[];

                  const priceLists = await prisma.$queryRaw`
                    SELECT * FROM "ClientPriceList"
                    WHERE "clientId" = ${c.id} AND "isActive" = true
                  ` as any[];

                  return {
                    ...c,
                    discounts: discounts || [],
                    priceLists: priceLists || [],
                  };
                } catch (error) {
                  console.log('Error obteniendo descuentos/listas para cliente:', c.id);
                  return {
                    ...c,
                    discounts: [],
                    priceLists: [],
                  };
                }
              })
            );

        return NextResponse.json({
          data: clients || [],
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
      } catch (rawError: any) {
        // Si la tabla no existe, devolver array vacío
        if (rawError.code === '42P01' || rawError.message?.includes('does not exist') ||
            (rawError.message?.includes('relation') && rawError.message?.includes('does not exist'))) {
          console.log('Tabla Client no existe, devolviendo array vacío');
          return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
        }
        console.error('Error en consulta raw:', rawError);
        throw rawError;
      }
    } catch (error: any) {
      console.error('Error al obtener clientes:', error);
      if (error.code === '42P01' || error.message?.includes('does not exist') ||
          (error.message?.includes('relation') && error.message?.includes('does not exist'))) {
        console.log('Tabla Client no existe, devolviendo array vacío');
      } else {
        console.log('Devolviendo array vacío debido a error:', error.message);
      }
      return NextResponse.json({ data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } });
    }
  } catch (outerError: any) {
    console.error('Error al obtener clientes:', outerError);
    console.log('Devolviendo array vacío debido a error:', outerError.message);
    return NextResponse.json({ data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } });
  }
}

// POST - Crear un nuevo cliente
export async function POST(request: NextRequest) {
  try {
    const auth = await getUserFromToken(request);
    if (!auth || !auth.userId || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      legalName, name, email, phone, alternatePhone, address, city, province, postalCode,
      cuit, taxCondition, clientTypeId, deliveryZoneId, sellerId, creditLimit, paymentTerms, checkTerms, saleCondition,
      contactPerson, merchandisePendingDays, grossIncome, activityStartDate,
      observations,
      // Condición de facturación (T1, T2, Mixto)
      tipoCondicionVenta, porcentajeFormal,
      // Nuevos campos del sistema legacy - ahora con FKs
      transportCompanyId, businessSectorId, settlementPeriod,
      requiresPurchaseOrder, isDeliveryBlocked, deliveryBlockedReason,
      quickNote, quickNoteExpiry, hasCheckLimit, checkLimitType, checkLimit, generalDiscount,
      // Campos de override temporal (duración de cambios)
      creditLimitOverride, creditLimitOverrideDays,
      merchandisePendingDaysOverride, merchandisePendingDaysOverrideDays,
      tempCreditLimit, tempCreditLimitOverride, tempCreditLimitOverrideDays,
      // Otros campos adicionales
      invoiceDueDays, accountBlockDays, extraBonusDescription,
      // Lista de descuentos asignada
      discountListId,
      // Lista de precios por defecto
      defaultPriceListId,
      // Nuevos campos extendidos
      whatsapp, municipalRetentionType, parentClientId,
      visitDays, deliveryDays,
      // Exenciones impositivas
      isVatPerceptionExempt, vatPerceptionExemptUntil, vatPerceptionExemptCertificate,
      isVatRetentionExempt, vatRetentionExemptUntil,
      isGrossIncomeExempt, grossIncomeExemptUntil,
      isMunicipalExempt, municipalExemptUntil
    } = body;

    if (!legalName || !email || !postalCode || !taxCondition) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: legalName (razón social), email, postalCode (código postal), taxCondition (condición fiscal)' },
        { status: 400 }
      );
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      );
    }

    // Verificar si ya existe un cliente con el mismo email en la empresa
    let existingClient = null;
    try {
      existingClient = await prisma.client.findFirst({
        where: {
          email: email.toLowerCase().trim(),
          companyId: auth.companyId,
        },
      });
    } catch (error: any) {
      // Si el modelo no está disponible, usar consulta raw
      if (error.message?.includes('Unknown model')) {
        const existing = await prisma.$queryRaw`
          SELECT id FROM "Client"
          WHERE email = ${email.toLowerCase().trim()}
            AND "companyId" = ${auth.companyId}
          LIMIT 1
        ` as any[];
        existingClient = existing.length > 0 ? existing[0] : null;
      } else {
        throw error;
      }
    }

    if (existingClient) {
      return NextResponse.json(
        { error: 'Ya existe un cliente con ese email en la empresa' },
        { status: 409 }
      );
    }

    // Crear el cliente
    let client = null;
    try {
      client = await prisma.client.create({
        data: {
          legalName: legalName.trim(),
          name: name?.trim() || null,
          email: email.toLowerCase().trim(),
          phone: phone?.trim() || null,
          alternatePhone: alternatePhone?.trim() || null,
          address: address?.trim() || null,
          city: city?.trim() || null,
          province: province?.trim() || null,
          postalCode: postalCode.trim(),
          cuit: cuit?.trim() || null,
          taxCondition: taxCondition,
          clientTypeId: clientTypeId || null,
          deliveryZoneId: deliveryZoneId || null,
          sellerId: sellerId === 'fabrica' ? null : (sellerId ? parseInt(sellerId) : null),
          creditLimit: creditLimit ? parseFloat(creditLimit) : null,
          paymentTerms: paymentTerms ? parseInt(paymentTerms) : null,
          checkTerms: checkTerms ? parseInt(checkTerms) : null,
          saleCondition: saleCondition || null,
          contactPerson: contactPerson?.trim() || null,
          merchandisePendingDays: merchandisePendingDays ? parseInt(merchandisePendingDays) : null,
          grossIncome: grossIncome?.trim() || null,
          activityStartDate: activityStartDate ? new Date(activityStartDate) : null,
          observations: observations?.trim() || null,
          companyId: auth.companyId,
          // Condición de facturación
          tipoCondicionVenta: tipoCondicionVenta || 'FORMAL',
          porcentajeFormal: tipoCondicionVenta === 'MIXTO' && porcentajeFormal ? parseFloat(porcentajeFormal) : null,
          // Nuevos campos del sistema legacy - ahora con FKs
          transportCompanyId: transportCompanyId || null,
          businessSectorId: businessSectorId || null,
          settlementPeriod: settlementPeriod || null,
          requiresPurchaseOrder: requiresPurchaseOrder === true,
          isDeliveryBlocked: isDeliveryBlocked === true,
          deliveryBlockedReason: isDeliveryBlocked ? deliveryBlockedReason?.trim() || null : null,
          quickNote: quickNote?.trim() || null,
          quickNoteExpiry: quickNoteExpiry ? new Date(quickNoteExpiry) : null,
          hasCheckLimit: hasCheckLimit === true,
          checkLimitType: hasCheckLimit ? (checkLimitType || 'SALDO') : null,
          checkLimit: hasCheckLimit && checkLimit ? parseFloat(checkLimit) : null,
          generalDiscount: generalDiscount ? parseFloat(generalDiscount) : null,
          // Override temporal de límites (duración de cambios)
          creditLimitOverride: creditLimitOverride ? parseFloat(creditLimitOverride) : null,
          creditLimitOverrideExpiry: creditLimitOverrideDays ? new Date(Date.now() + creditLimitOverrideDays * 24 * 60 * 60 * 1000) : null,
          merchandisePendingDaysOverride: merchandisePendingDaysOverride ? parseInt(merchandisePendingDaysOverride) : null,
          merchandisePendingDaysOverrideExpiry: merchandisePendingDaysOverrideDays ? new Date(Date.now() + merchandisePendingDaysOverrideDays * 24 * 60 * 60 * 1000) : null,
          tempCreditLimit: tempCreditLimit ? parseFloat(tempCreditLimit) : null,
          tempCreditLimitOverride: tempCreditLimitOverride ? parseFloat(tempCreditLimitOverride) : null,
          tempCreditLimitOverrideExpiry: tempCreditLimitOverrideDays ? new Date(Date.now() + tempCreditLimitOverrideDays * 24 * 60 * 60 * 1000) : null,
          // Otros campos adicionales
          invoiceDueDays: invoiceDueDays ? parseInt(invoiceDueDays) : 15,
          accountBlockDays: accountBlockDays ? parseInt(accountBlockDays) : null,
          extraBonusDescription: extraBonusDescription?.trim() || null,
          // Lista de descuentos asignada
          discountListId: discountListId || null,
          // Lista de precios por defecto
          defaultPriceListId: defaultPriceListId ? parseInt(defaultPriceListId) : null,
          // Nuevos campos extendidos
          whatsapp: whatsapp?.trim() || null,
          municipalRetentionType: municipalRetentionType || null,
          parentClientId: parentClientId || null,
          visitDays: visitDays || [],
          deliveryDays: deliveryDays || [],
          // Exenciones impositivas
          isVatPerceptionExempt: isVatPerceptionExempt || false,
          vatPerceptionExemptUntil: vatPerceptionExemptUntil ? new Date(vatPerceptionExemptUntil) : null,
          vatPerceptionExemptCertificate: vatPerceptionExemptCertificate?.trim() || null,
          isVatRetentionExempt: isVatRetentionExempt || false,
          vatRetentionExemptUntil: vatRetentionExemptUntil ? new Date(vatRetentionExemptUntil) : null,
          isGrossIncomeExempt: isGrossIncomeExempt || false,
          grossIncomeExemptUntil: grossIncomeExemptUntil ? new Date(grossIncomeExemptUntil) : null,
          isMunicipalExempt: isMunicipalExempt || false,
          municipalExemptUntil: municipalExemptUntil ? new Date(municipalExemptUntil) : null,
        },
        include: {
          discounts: true,
          priceLists: true,
          clientType: true,
          deliveryZone: true,
          seller: { select: { id: true, name: true } },
          transportCompany: true,
          businessSector: true,
          discountList: true,
          parentClient: { select: { id: true, legalName: true } },
          subClients: { select: { id: true, legalName: true } },
        },
      });
    } catch (error: any) {
      // Si el modelo no está disponible, usar consulta raw
      if (error.message?.includes('Unknown model')) {
        // Generar ID usando cuid (similar a Prisma)
        const cuid = () => {
          const timestamp = Date.now().toString(36);
          const random = Math.random().toString(36).substring(2, 15);
          return `cl${timestamp}${random}`;
        };
        const clientId = cuid();
        
        // Calcular fechas de expiración para overrides
        const creditLimitOverrideExpiryDate = creditLimitOverrideDays ? new Date(Date.now() + creditLimitOverrideDays * 24 * 60 * 60 * 1000) : null;
        const merchandisePendingDaysOverrideExpiryDate = merchandisePendingDaysOverrideDays ? new Date(Date.now() + merchandisePendingDaysOverrideDays * 24 * 60 * 60 * 1000) : null;
        const tempCreditLimitOverrideExpiryDate = tempCreditLimitOverrideDays ? new Date(Date.now() + tempCreditLimitOverrideDays * 24 * 60 * 60 * 1000) : null;

        await prisma.$executeRaw`
          INSERT INTO "Client" (
            id, "legalName", name, email, phone, "alternatePhone", address, city, province, "postalCode",
            cuit, "taxCondition", "clientTypeId", "deliveryZoneId", "sellerId", "creditLimit", "currentBalance", "paymentTerms", "checkTerms",
            "saleCondition", "contactPerson", "merchandisePendingDays", "grossIncome",
            "activityStartDate", observations, "companyId", "isActive", "createdAt", "updatedAt",
            "tipoCondicionVenta", "porcentajeFormal", "isBlocked",
            "transportCompanyId", "businessSectorId", "settlementPeriod",
            "requiresPurchaseOrder", "isDeliveryBlocked", "deliveryBlockedReason",
            "quickNote", "quickNoteExpiry", "hasCheckLimit", "checkLimitType", "checkLimit", "generalDiscount",
            "creditLimitOverride", "creditLimitOverrideExpiry",
            "merchandisePendingDaysOverride", "merchandisePendingDaysOverrideExpiry",
            "tempCreditLimit", "tempCreditLimitOverride", "tempCreditLimitOverrideExpiry",
            "invoiceDueDays", "accountBlockDays", "extraBonusDescription",
            "discountListId", "defaultPriceListId",
            whatsapp, "municipalRetentionType", "parentClientId",
            "visitDays", "deliveryDays",
            "isVatPerceptionExempt", "vatPerceptionExemptUntil", "vatPerceptionExemptCertificate",
            "isVatRetentionExempt", "vatRetentionExemptUntil",
            "isGrossIncomeExempt", "grossIncomeExemptUntil",
            "isMunicipalExempt", "municipalExemptUntil"
          ) VALUES (
            ${clientId},
            ${legalName.trim()},
            ${name?.trim() || null},
            ${email.toLowerCase().trim()},
            ${phone?.trim() || null},
            ${alternatePhone?.trim() || null},
            ${address?.trim() || null},
            ${city?.trim() || null},
            ${province?.trim() || null},
            ${postalCode.trim()},
            ${cuit?.trim() || null},
            ${taxCondition},
            ${clientTypeId || null},
            ${deliveryZoneId || null},
            ${sellerId === 'fabrica' ? null : (sellerId ? parseInt(sellerId) : null)},
            ${creditLimit ? parseFloat(creditLimit) : null},
            0,
            ${paymentTerms ? parseInt(paymentTerms) : null},
            ${checkTerms ? parseInt(checkTerms) : null},
            ${saleCondition || null},
            ${contactPerson?.trim() || null},
            ${merchandisePendingDays ? parseInt(merchandisePendingDays) : null},
            ${grossIncome?.trim() || null},
            ${activityStartDate ? new Date(activityStartDate) : null},
            ${observations?.trim() || null},
            ${auth.companyId},
            true,
            NOW(),
            NOW(),
            ${tipoCondicionVenta || 'FORMAL'},
            ${tipoCondicionVenta === 'MIXTO' && porcentajeFormal ? parseFloat(porcentajeFormal) : null},
            false,
            ${transportCompanyId || null},
            ${businessSectorId || null},
            ${settlementPeriod || null}::"SettlementPeriod",
            ${requiresPurchaseOrder === true},
            ${isDeliveryBlocked === true},
            ${isDeliveryBlocked ? deliveryBlockedReason?.trim() || null : null},
            ${quickNote?.trim() || null},
            ${quickNoteExpiry ? new Date(quickNoteExpiry) : null},
            ${hasCheckLimit === true},
            ${hasCheckLimit ? (checkLimitType || 'SALDO') : null},
            ${hasCheckLimit && checkLimit ? parseFloat(checkLimit) : null},
            ${generalDiscount ? parseFloat(generalDiscount) : null},
            ${creditLimitOverride ? parseFloat(creditLimitOverride) : null},
            ${creditLimitOverrideExpiryDate},
            ${merchandisePendingDaysOverride ? parseInt(merchandisePendingDaysOverride) : null},
            ${merchandisePendingDaysOverrideExpiryDate},
            ${tempCreditLimit ? parseFloat(tempCreditLimit) : null},
            ${tempCreditLimitOverride ? parseFloat(tempCreditLimitOverride) : null},
            ${tempCreditLimitOverrideExpiryDate},
            ${invoiceDueDays ? parseInt(invoiceDueDays) : 15},
            ${accountBlockDays ? parseInt(accountBlockDays) : null},
            ${extraBonusDescription?.trim() || null},
            ${discountListId || null},
            ${defaultPriceListId ? parseInt(defaultPriceListId) : null},
            ${whatsapp?.trim() || null},
            ${municipalRetentionType || null},
            ${parentClientId || null},
            ${JSON.stringify(visitDays || [])}::jsonb,
            ${JSON.stringify(deliveryDays || [])}::jsonb,
            ${isVatPerceptionExempt === true},
            ${vatPerceptionExemptUntil ? new Date(vatPerceptionExemptUntil) : null},
            ${vatPerceptionExemptCertificate?.trim() || null},
            ${isVatRetentionExempt === true},
            ${vatRetentionExemptUntil ? new Date(vatRetentionExemptUntil) : null},
            ${isGrossIncomeExempt === true},
            ${grossIncomeExemptUntil ? new Date(grossIncomeExemptUntil) : null},
            ${isMunicipalExempt === true},
            ${municipalExemptUntil ? new Date(municipalExemptUntil) : null}
          )
        `;

        // Obtener el cliente creado
        const created = await prisma.$queryRaw`
          SELECT
            c.id,
            c."legalName",
            c.name,
            c.email,
            c.phone,
            c."alternatePhone",
            c.address,
            c.city,
            c.province,
            c."postalCode",
            c.cuit,
            c."taxCondition",
            c."creditLimit",
            c."currentBalance",
            c."paymentTerms",
            c."checkTerms",
            c."saleCondition",
            c."contactPerson",
            c."merchandisePendingDays",
            c."grossIncome",
            c."activityStartDate",
            c."clientTypeId",
            c."deliveryZoneId",
            c."sellerId",
            c."isActive",
            c."isBlocked",
            c."blockedReason",
            c."blockedAt",
            c.observations,
            c."createdAt",
            c."updatedAt",
            c."tipoCondicionVenta",
            c."porcentajeFormal",
            c."transportCompanyId",
            c."businessSectorId",
            c."settlementPeriod",
            c."requiresPurchaseOrder",
            c."isDeliveryBlocked",
            c."deliveryBlockedReason",
            c."deliveryBlockedAt",
            c."quickNote",
            c."quickNoteExpiry",
            c."hasCheckLimit",
            c."checkLimitType",
            c."checkLimit",
            c."generalDiscount",
            c."creditLimitOverride",
            c."creditLimitOverrideExpiry",
            c."merchandisePendingDaysOverride",
            c."merchandisePendingDaysOverrideExpiry",
            c."tempCreditLimit",
            c."tempCreditLimitOverride",
            c."tempCreditLimitOverrideExpiry",
            c."invoiceDueDays",
            c."accountBlockDays",
            c."extraBonusDescription",
            c."discountListId",
            c."defaultPriceListId",
            c.whatsapp,
            c."municipalRetentionType",
            c."parentClientId",
            c."visitDays",
            c."deliveryDays",
            c."isVatPerceptionExempt",
            c."vatPerceptionExemptUntil",
            c."vatPerceptionExemptCertificate",
            c."isVatRetentionExempt",
            c."vatRetentionExemptUntil",
            c."isGrossIncomeExempt",
            c."grossIncomeExemptUntil",
            c."isMunicipalExempt",
            c."municipalExemptUntil",
            '[]'::json as discounts,
            '[]'::json as "priceLists",
            '[]'::json as "subClients"
          FROM "Client" c
          WHERE c.id = ${clientId}
        ` as any[];

        client = created[0];
      } else {
        throw error;
      }
    }

    return NextResponse.json(client, { status: 201 });
  } catch (error: any) {
    console.error('Error al crear cliente:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      meta: error.meta
    });
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Ya existe un cliente con ese email en la empresa' },
        { status: 409 }
      );
    }
    
    // Si es un error de tabla no existe, dar un mensaje más claro
    if (error.code === '42P01' || error.message?.includes('does not exist') || 
        (error.message?.includes('relation') && error.message?.includes('does not exist'))) {
      return NextResponse.json(
        { error: 'La tabla de clientes no está disponible. Por favor, contacte al administrador.' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error al crear cliente', details: error.message },
      { status: 500 }
    );
  }
}

