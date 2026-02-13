import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

// GET - Obtener cliente por ID
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CLIENTES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get('includeStats') === 'true';

    const cliente = await prisma.client.findFirst({
      where: { id, companyId },
      include: {
        clientType: { select: { id: true, name: true } },
        deliveryZone: { select: { id: true, name: true } },
        seller: { select: { id: true, name: true } },
        defaultPriceList: { select: { id: true, nombre: true } },
        discountList: { select: { id: true, name: true } },
        transportCompany: { select: { id: true, name: true } },
        businessSector: { select: { id: true, name: true } },
        blockedByUser: { select: { id: true, name: true } },
        ...(includeStats && {
          _count: {
            select: {
              invoices: true,
              payments: true,
              quotes: true,
              sales: true,
            }
          }
        }),
      }
    });

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Optionally get recent activity
    if (includeStats) {
      const [recentInvoices, recentPayments] = await Promise.all([
        prisma.salesInvoice.findMany({
          where: { clientId: id, companyId },
          select: {
            id: true,
            numero: true,
            fechaEmision: true,
            total: true,
            estado: true,
            saldoPendiente: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        prisma.clientPayment.findMany({
          where: { clientId: id, companyId },
          select: {
            id: true,
            numero: true,
            fechaPago: true,
            totalPago: true,
            estado: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ]);

      return NextResponse.json({
        ...cliente,
        recentInvoices,
        recentPayments,
      });
    }

    return NextResponse.json(cliente);
  } catch (error) {
    console.error('Error fetching cliente:', error);
    return NextResponse.json({ error: 'Error al obtener cliente' }, { status: 500 });
  }
}

// PUT - Actualizar cliente
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CLIENTES_EDIT);
    if (error) return error;

    const companyId = user!.companyId;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    // Verify client exists
    const existing = await prisma.client.findFirst({
      where: { id, companyId }
    });
    if (!existing) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const {
      legalName,
      email,
      postalCode,
      name,
      phone,
      alternatePhone,
      address,
      city,
      province,
      cuit,
      taxCondition,
      observations,
      contactPerson,
      creditLimit,
      paymentTerms,
      checkTerms,
      invoiceDueDays,
      clientTypeId,
      deliveryZoneId,
      sellerId,
      defaultPriceListId,
      discountListId,
      tipoCondicionVenta,
      porcentajeFormal,
      saleCondition,
      limiteAcopio,
      diasAlertaAcopio,
      hasCheckLimit,
      checkLimitType,
      checkLimit,
      settlementPeriod,
      requiresPurchaseOrder,
      grossIncome,
      activityStartDate,
      merchandisePendingDays,
      accountBlockDays,
      extraBonusDescription,
      transportCompanyId,
      businessSectorId,
      quickNote,
      quickNoteExpiry,
      isActive,
      // Override temporal fields
      creditLimitOverride,
      creditLimitOverrideExpiry,
      merchandisePendingDaysOverride,
      merchandisePendingDaysOverrideExpiry,
      tempCreditLimit,
      tempCreditLimitOverride,
      tempCreditLimitOverrideExpiry,
      // Campos extendidos
      whatsapp,
      municipalRetentionType,
      parentClientId,
      visitDays,
      deliveryDays,
      // Exenciones impositivas
      isVatPerceptionExempt,
      vatPerceptionExemptUntil,
      vatPerceptionExemptCertificate,
      isVatRetentionExempt,
      vatRetentionExemptUntil,
      isGrossIncomeExempt,
      grossIncomeExemptUntil,
      isMunicipalExempt,
      municipalExemptUntil,
    } = body;

    // Validate email if changed
    if (email && email !== existing.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
      }

      const existingEmail = await prisma.client.findFirst({
        where: { companyId, email, id: { not: id } }
      });
      if (existingEmail) {
        return NextResponse.json({ error: 'Ya existe un cliente con ese email' }, { status: 400 });
      }
    }

    // Validate and check CUIT if changed
    let formattedCuit: string | null = null;
    if (cuit && cuit !== existing.cuit) {
      // Validate CUIT using comprehensive validator (check digit algorithm)
      const { validateCUIT } = await import('@/lib/ventas/cuit-validator');
      const cuitValidation = validateCUIT(cuit);

      if (!cuitValidation.valid) {
        return NextResponse.json({
          error: 'CUIT inválido',
          details: cuitValidation.error
        }, { status: 400 });
      }

      formattedCuit = cuitValidation.formatted!;

      // Check for duplicate CUIT (use cleaned version)
      const cleanCuit = formattedCuit.replace(/[-\s]/g, '');
      const existingCuit = await prisma.client.findFirst({
        where: {
          companyId,
          cuit: { in: [formattedCuit, cleanCuit, cuit] },
          id: { not: id }
        }
      });
      if (existingCuit) {
        return NextResponse.json({ error: 'Ya existe un cliente con ese CUIT' }, { status: 400 });
      }
    }

    const cliente = await prisma.client.update({
      where: { id },
      data: {
        ...(legalName !== undefined && { legalName }),
        ...(email !== undefined && { email }),
        ...(postalCode !== undefined && { postalCode }),
        ...(name !== undefined && { name: name || null }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(alternatePhone !== undefined && { alternatePhone: alternatePhone || null }),
        ...(address !== undefined && { address: address || null }),
        ...(city !== undefined && { city: city || null }),
        ...(province !== undefined && { province: province || null }),
        ...(cuit !== undefined && { cuit: formattedCuit || cuit || null }),
        ...(taxCondition !== undefined && { taxCondition }),
        ...(observations !== undefined && { observations: observations || null }),
        ...(contactPerson !== undefined && { contactPerson: contactPerson || null }),
        ...(creditLimit !== undefined && { creditLimit: creditLimit !== null ? parseFloat(creditLimit) : null }),
        ...(paymentTerms !== undefined && { paymentTerms: parseInt(paymentTerms) }),
        ...(checkTerms !== undefined && { checkTerms: checkTerms !== null ? parseInt(checkTerms) : null }),
        ...(invoiceDueDays !== undefined && { invoiceDueDays: parseInt(invoiceDueDays) }),
        ...(clientTypeId !== undefined && { clientTypeId: clientTypeId || null }),
        ...(deliveryZoneId !== undefined && { deliveryZoneId: deliveryZoneId || null }),
        ...(sellerId !== undefined && { sellerId: sellerId !== null ? parseInt(sellerId) : null }),
        ...(defaultPriceListId !== undefined && { defaultPriceListId: defaultPriceListId || null }),
        ...(discountListId !== undefined && { discountListId: discountListId || null }),
        ...(tipoCondicionVenta !== undefined && { tipoCondicionVenta }),
        ...(porcentajeFormal !== undefined && { porcentajeFormal: porcentajeFormal !== null ? parseFloat(porcentajeFormal) : null }),
        ...(saleCondition !== undefined && { saleCondition: saleCondition || null }),
        ...(limiteAcopio !== undefined && { limiteAcopio: limiteAcopio !== null ? parseFloat(limiteAcopio) : null }),
        ...(diasAlertaAcopio !== undefined && { diasAlertaAcopio: diasAlertaAcopio !== null ? parseInt(diasAlertaAcopio) : null }),
        ...(hasCheckLimit !== undefined && { hasCheckLimit }),
        ...(checkLimitType !== undefined && { checkLimitType: checkLimitType || null }),
        ...(checkLimit !== undefined && { checkLimit: checkLimit !== null ? parseFloat(checkLimit) : null }),
        ...(settlementPeriod !== undefined && { settlementPeriod: settlementPeriod || null }),
        ...(requiresPurchaseOrder !== undefined && { requiresPurchaseOrder }),
        ...(grossIncome !== undefined && { grossIncome: grossIncome || null }),
        ...(activityStartDate !== undefined && { activityStartDate: activityStartDate ? new Date(activityStartDate) : null }),
        ...(merchandisePendingDays !== undefined && { merchandisePendingDays: merchandisePendingDays !== null ? parseInt(merchandisePendingDays) : null }),
        ...(accountBlockDays !== undefined && { accountBlockDays: accountBlockDays !== null ? parseInt(accountBlockDays) : null }),
        ...(extraBonusDescription !== undefined && { extraBonusDescription: extraBonusDescription || null }),
        ...(transportCompanyId !== undefined && { transportCompanyId: transportCompanyId || null }),
        ...(businessSectorId !== undefined && { businessSectorId: businessSectorId || null }),
        ...(quickNote !== undefined && { quickNote: quickNote || null }),
        ...(quickNoteExpiry !== undefined && { quickNoteExpiry: quickNoteExpiry ? new Date(quickNoteExpiry) : null }),
        ...(isActive !== undefined && { isActive }),
        // Override fields
        ...(creditLimitOverride !== undefined && { creditLimitOverride: creditLimitOverride !== null ? parseFloat(creditLimitOverride) : null }),
        ...(creditLimitOverrideExpiry !== undefined && { creditLimitOverrideExpiry: creditLimitOverrideExpiry ? new Date(creditLimitOverrideExpiry) : null }),
        ...(merchandisePendingDaysOverride !== undefined && { merchandisePendingDaysOverride: merchandisePendingDaysOverride !== null ? parseInt(merchandisePendingDaysOverride) : null }),
        ...(merchandisePendingDaysOverrideExpiry !== undefined && { merchandisePendingDaysOverrideExpiry: merchandisePendingDaysOverrideExpiry ? new Date(merchandisePendingDaysOverrideExpiry) : null }),
        ...(tempCreditLimit !== undefined && { tempCreditLimit: tempCreditLimit !== null ? parseFloat(tempCreditLimit) : null }),
        ...(tempCreditLimitOverride !== undefined && { tempCreditLimitOverride: tempCreditLimitOverride !== null ? parseFloat(tempCreditLimitOverride) : null }),
        ...(tempCreditLimitOverrideExpiry !== undefined && { tempCreditLimitOverrideExpiry: tempCreditLimitOverrideExpiry ? new Date(tempCreditLimitOverrideExpiry) : null }),
        // Extended fields
        ...(whatsapp !== undefined && { whatsapp: whatsapp || null }),
        ...(municipalRetentionType !== undefined && { municipalRetentionType: municipalRetentionType || null }),
        ...(parentClientId !== undefined && { parentClientId: parentClientId || null }),
        ...(visitDays !== undefined && { visitDays: visitDays || null }),
        ...(deliveryDays !== undefined && { deliveryDays: deliveryDays || null }),
        // Tax exemptions
        ...(isVatPerceptionExempt !== undefined && { isVatPerceptionExempt }),
        ...(vatPerceptionExemptUntil !== undefined && { vatPerceptionExemptUntil: vatPerceptionExemptUntil ? new Date(vatPerceptionExemptUntil) : null }),
        ...(vatPerceptionExemptCertificate !== undefined && { vatPerceptionExemptCertificate: vatPerceptionExemptCertificate || null }),
        ...(isVatRetentionExempt !== undefined && { isVatRetentionExempt }),
        ...(vatRetentionExemptUntil !== undefined && { vatRetentionExemptUntil: vatRetentionExemptUntil ? new Date(vatRetentionExemptUntil) : null }),
        ...(isGrossIncomeExempt !== undefined && { isGrossIncomeExempt }),
        ...(grossIncomeExemptUntil !== undefined && { grossIncomeExemptUntil: grossIncomeExemptUntil ? new Date(grossIncomeExemptUntil) : null }),
        ...(isMunicipalExempt !== undefined && { isMunicipalExempt }),
        ...(municipalExemptUntil !== undefined && { municipalExemptUntil: municipalExemptUntil ? new Date(municipalExemptUntil) : null }),
      },
      include: {
        clientType: { select: { id: true, name: true } },
        deliveryZone: { select: { id: true, name: true } },
        seller: { select: { id: true, name: true } },
        defaultPriceList: { select: { id: true, nombre: true } },
        discountList: { select: { id: true, name: true } },
      }
    });

    return NextResponse.json(cliente);
  } catch (error) {
    console.error('Error updating cliente:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json({ error: 'Datos duplicados' }, { status: 400 });
      }
    }
    return NextResponse.json({ error: 'Error al actualizar cliente' }, { status: 500 });
  }
}

// DELETE - Desactivar cliente (soft delete)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CLIENTES_DELETE);
    if (error) return error;

    const companyId = user!.companyId;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    // Verify client exists
    const existing = await prisma.client.findFirst({
      where: { id, companyId }
    });
    if (!existing) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Check for pending invoices or active sales
    const [pendingInvoices, activeSales] = await Promise.all([
      prisma.salesInvoice.count({
        where: {
          clientId: id,
          companyId,
          estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] }
        }
      }),
      prisma.sale.count({
        where: {
          clientId: id,
          companyId,
          estado: { in: ['CONFIRMADA', 'EN_PREPARACION', 'PARCIALMENTE_ENTREGADA'] }
        }
      })
    ]);

    if (pendingInvoices > 0) {
      return NextResponse.json({
        error: `No se puede desactivar el cliente porque tiene ${pendingInvoices} factura(s) pendiente(s) de cobro`
      }, { status: 400 });
    }

    if (activeSales > 0) {
      return NextResponse.json({
        error: `No se puede desactivar el cliente porque tiene ${activeSales} pedido(s) activo(s)`
      }, { status: 400 });
    }

    // Soft delete - deactivate
    await prisma.client.update({
      where: { id },
      data: { isActive: false }
    });

    return NextResponse.json({ message: 'Cliente desactivado correctamente' });
  } catch (error) {
    console.error('Error deleting cliente:', error);
    return NextResponse.json({ error: 'Error al desactivar cliente' }, { status: 500 });
  }
}
