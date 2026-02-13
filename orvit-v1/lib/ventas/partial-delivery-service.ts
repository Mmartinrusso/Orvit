import { prisma } from '@/lib/prisma';

export async function syncDeliveryQuantities(saleId: number) {
  // Obtener todas las entregas de la orden
  const deliveries = await prisma.saleDelivery.findMany({
    where: { saleId },
    include: { items: true },
  });

  // Obtener items de la venta
  const saleItems = await prisma.saleItem.findMany({
    where: { saleId },
  });

  // Calcular cantidades entregadas por item
  for (const saleItem of saleItems) {
    const cantidadEntregada = deliveries.reduce((total, delivery) => {
      const deliveryItem = delivery.items.find(
        (di: any) => di.saleItemId === saleItem.id
      );
      return total + Number(deliveryItem?.cantidadEntregada || 0);
    }, 0);

    const cantidadPendiente = Number(saleItem.cantidad) - cantidadEntregada;

    await prisma.saleItem.update({
      where: { id: saleItem.id },
      data: {
        cantidadEntregada,
        cantidadPendiente,
      },
    });
  }

  // Actualizar estado de la orden
  await updateSaleDeliveryStatus(saleId);
}

export async function updateSaleDeliveryStatus(saleId: number) {
  const items = await prisma.saleItem.findMany({
    where: { saleId },
  });

  const totalItems = items.length;
  const itemsCompletamenteEntregados = items.filter(
    (i) => Number(i.cantidadEntregada) >= Number(i.cantidad)
  ).length;
  const itemsParcialmenteEntregados = items.filter(
    (i) => Number(i.cantidadEntregada) > 0 && Number(i.cantidadEntregada) < Number(i.cantidad)
  ).length;

  let nuevoEstado = 'CONFIRMADA';

  if (itemsCompletamenteEntregados === totalItems) {
    nuevoEstado = 'ENTREGADA';
  } else if (itemsParcialmenteEntregados > 0 || itemsCompletamenteEntregados > 0) {
    nuevoEstado = 'PARCIALMENTE_ENTREGADA';
  }

  await prisma.sale.update({
    where: { id: saleId },
    data: { estado: nuevoEstado as any },
  });

  return nuevoEstado;
}

export async function createPartialDelivery(
  saleId: number,
  companyId: number,
  userId: number,
  items: Array<{ saleItemId: number; cantidad: number }>
) {
  // Validar que no se entregue más de lo pendiente
  for (const item of items) {
    const saleItem = await prisma.saleItem.findUnique({
      where: { id: item.saleItemId },
    });

    if (!saleItem) {
      throw new Error(`Item ${item.saleItemId} no encontrado`);
    }

    const cantidadPendiente = Number(saleItem.cantidadPendiente);
    if (item.cantidad > cantidadPendiente) {
      throw new Error(
        `Cantidad a entregar (${item.cantidad}) excede la pendiente (${cantidadPendiente}) para el item ${saleItem.descripcion}`
      );
    }
  }

  // Generar número de entrega
  const lastDelivery = await prisma.saleDelivery.findFirst({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
  });

  const nextNumber = lastDelivery
    ? parseInt(lastDelivery.numero.split('-').pop() || '0') + 1
    : 1;
  const numero = `ENT-${new Date().getFullYear()}-${String(nextNumber).padStart(5, '0')}`;

  // Crear entrega
  const delivery = await prisma.saleDelivery.create({
    data: {
      numero,
      saleId,
      companyId,
      estado: 'PENDIENTE',
      fechaEntrega: new Date(),
      createdBy: userId,
    },
  });

  // Crear items de entrega
  for (const item of items) {
    const saleItem = await prisma.saleItem.findUnique({
      where: { id: item.saleItemId },
    });

    await prisma.saleDeliveryItem.create({
      data: {
        deliveryId: delivery.id,
        saleItemId: item.saleItemId,
        productId: saleItem!.productId,
        codigo: saleItem!.codigo,
        descripcion: saleItem!.descripcion,
        cantidadEntregada: item.cantidad,
        unidad: saleItem!.unidad,
      },
    });
  }

  // Sincronizar cantidades
  await syncDeliveryQuantities(saleId);

  return delivery;
}

export async function getDeliveryProgress(saleId: number) {
  const items = await prisma.saleItem.findMany({
    where: { saleId },
  });

  return items.map((item) => ({
    id: item.id,
    codigo: item.codigo,
    descripcion: item.descripcion,
    cantidad: Number(item.cantidad),
    cantidadEntregada: Number(item.cantidadEntregada || 0),
    cantidadPendiente: Number(item.cantidadPendiente || item.cantidad),
    porcentajeEntregado:
      (Number(item.cantidadEntregada || 0) / Number(item.cantidad)) * 100,
  }));
}
