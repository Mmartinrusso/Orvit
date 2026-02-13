import { prisma } from '@/lib/prisma';

export interface ApprovalRule {
  condition: 'MARGEN_BAJO' | 'MONTO_ALTO';
  threshold: number;
  niveles: number;
}

export async function checkApprovalNeeded(
  orden: any,
  salesConfig?: {
    marginApprovalThreshold?: any;
    montoMinimoAprobacionCot?: any;
  }
): Promise<{
  required: boolean;
  motivo?: string;
  niveles?: number;
}> {
  // Calcular margen promedio
  let totalMargen = 0;
  let itemsWithMargen = 0;

  for (const item of orden.items) {
    const precio = Number(item.precioUnitario);
    const costo = Number(item.costoUnitario || 0);
    if (costo > 0) {
      const margen = ((precio - costo) / precio) * 100;
      totalMargen += margen;
      itemsWithMargen++;
    }
  }

  const margenPromedio = itemsWithMargen > 0 ? totalMargen / itemsWithMargen : 0;
  const total = Number(orden.total);

  // Configuración desde SalesConfig (con fallbacks a valores por defecto)
  const MARGEN_MINIMO = salesConfig?.marginApprovalThreshold
    ? Number(salesConfig.marginApprovalThreshold)
    : 15;
  const MONTO_ALTO = salesConfig?.montoMinimoAprobacionCot
    ? Number(salesConfig.montoMinimoAprobacionCot)
    : 500000;
  const MONTO_MUY_ALTO = MONTO_ALTO * 2; // Doble del monto alto

  // Margen bajo
  if (margenPromedio < MARGEN_MINIMO) {
    return {
      required: true,
      motivo: 'MARGEN_BAJO',
      niveles: total > MONTO_ALTO ? 2 : 1,
    };
  }

  // Monto muy alto
  if (total > MONTO_MUY_ALTO) {
    return {
      required: true,
      motivo: 'MONTO_ALTO',
      niveles: 2,
    };
  }

  // Monto alto
  if (total > MONTO_ALTO) {
    return {
      required: true,
      motivo: 'MONTO_ALTO',
      niveles: 1,
    };
  }

  return { required: false };
}

export async function createApprovalWorkflow(
  ordenId: number,
  companyId: number,
  niveles: number,
  motivo: string,
  solicitadoBy: number
) {
  // Crear workflow
  const workflow = await prisma.$executeRaw`
    INSERT INTO sales_approval_workflows
    ("ordenId", "companyId", motivo, "nivelesRequeridos", "solicitadoBy", "expiraAt", "createdAt", "updatedAt")
    VALUES (
      ${ordenId}, ${companyId}, ${motivo}, ${niveles}, ${solicitadoBy},
      ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)},
      NOW(), NOW()
    )
    RETURNING id
  `;

  // Crear niveles de aprobación
  for (let i = 1; i <= niveles; i++) {
    const rol = i === 1 ? 'SUPERVISOR' : 'GERENTE';
    await prisma.$executeRaw`
      INSERT INTO sales_approval_levels ("workflowId", nivel, "aprobarPorRol", "createdAt", "updatedAt")
      VALUES (${(workflow as any)[0].id}, ${i}, ${rol}, NOW(), NOW())
    `;
  }

  return (workflow as any)[0].id;
}

export async function approveLevel(levelId: number, userId: number, comentario?: string) {
  await prisma.$executeRaw`
    UPDATE sales_approval_levels
    SET estado = 'APROBADO',
        "aprobadoPor" = ${userId},
        "aprobadoAt" = NOW(),
        comentario = ${comentario || null}
    WHERE id = ${levelId}
  `;

  // Verificar si todos los niveles están aprobados
  const workflow = await prisma.$queryRawUnsafe<any[]>(`
    SELECT w.*, l."ordenId"
    FROM sales_approval_workflows w
    INNER JOIN sales_approval_levels l ON l."workflowId" = w.id
    WHERE l.id = ${levelId}
    LIMIT 1
  `);

  if (workflow[0]) {
    const allLevels = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM sales_approval_levels
      WHERE "workflowId" = ${workflow[0].id}
      ORDER BY nivel
    `);

    const allApproved = allLevels.every(l => l.estado === 'APROBADO');

    if (allApproved) {
      // Actualizar workflow
      await prisma.$executeRaw`
        UPDATE sales_approval_workflows
        SET estado = 'APROBADO', "completadoAt" = NOW()
        WHERE id = ${workflow[0].id}
      `;

      // Confirmar orden automáticamente
      await prisma.$executeRaw`
        UPDATE sales
        SET estado = 'CONFIRMADA', "requiereAprobacion" = false, "aprobadoPor" = ${userId}, "aprobadoAt" = NOW()
        WHERE id = ${workflow[0].ordenId}
      `;
    }
  }
}

export async function rejectLevel(levelId: number, userId: number, motivo: string) {
  await prisma.$executeRaw`
    UPDATE sales_approval_levels
    SET estado = 'RECHAZADO',
        "aprobadoPor" = ${userId},
        "aprobadoAt" = NOW(),
        comentario = ${motivo}
    WHERE id = ${levelId}
  `;

  // Marcar workflow como rechazado
  const workflow = await prisma.$queryRawUnsafe<any[]>(`
    SELECT w.*, l."ordenId"
    FROM sales_approval_workflows w
    INNER JOIN sales_approval_levels l ON l."workflowId" = w.id
    WHERE l.id = ${levelId}
    LIMIT 1
  `);

  if (workflow[0]) {
    await prisma.$executeRaw`
      UPDATE sales_approval_workflows
      SET estado = 'RECHAZADO', "completadoAt" = NOW()
      WHERE id = ${workflow[0].id}
    `;

    // Marcar orden como rechazada
    await prisma.$executeRaw`
      UPDATE sales
      SET estado = 'CANCELADA'
      WHERE id = ${workflow[0].ordenId}
    `;
  }
}
