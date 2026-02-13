import { NextRequest, NextResponse } from 'next/server';
import { prismaUnfiltered } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Modelos válidos para soft delete
const VALID_MODELS = ['WorkOrder', 'Task', 'FixedTask', 'MaintenanceChecklist'] as const;
type SoftDeleteModel = typeof VALID_MODELS[number];

// Mapeo de modelo a nombre legible
const MODEL_LABELS: Record<SoftDeleteModel, string> = {
  WorkOrder: 'Orden de Trabajo',
  Task: 'Tarea',
  FixedTask: 'Tarea Fija',
  MaintenanceChecklist: 'Checklist de Mantenimiento',
};

async function getAdminUser(request: NextRequest) {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prismaUnfiltered.user.findUnique({
      where: { id: payload.userId as number },
      select: { id: true, role: true, name: true },
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

// GET /api/admin/soft-delete - Listar registros eliminados con paginación
export async function GET(request: NextRequest) {
  try {
    const user = await getAdminUser(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const model = searchParams.get('model') as SoftDeleteModel | null;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const skip = (page - 1) * limit;

    // Si se especifica un modelo, listar solo ese modelo
    if (model) {
      if (!VALID_MODELS.includes(model)) {
        return NextResponse.json(
          { error: `Modelo inválido. Opciones: ${VALID_MODELS.join(', ')}` },
          { status: 400 }
        );
      }

      const result = await getDeletedRecords(model, skip, limit);
      return NextResponse.json({
        model,
        modelLabel: MODEL_LABELS[model],
        ...result,
        page,
        limit,
      });
    }

    // Sin modelo: devolver resumen de todos los modelos
    const summary = await Promise.all(
      VALID_MODELS.map(async (m) => {
        const count = await getDeletedCount(m);
        return { model: m, label: MODEL_LABELS[m], deletedCount: count };
      })
    );

    return NextResponse.json({
      summary,
      totalDeleted: summary.reduce((sum, s) => sum + s.deletedCount, 0),
    });
  } catch (error) {
    console.error('Error listando registros eliminados:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/admin/soft-delete - Restaurar registros eliminados
export async function POST(request: NextRequest) {
  try {
    const user = await getAdminUser(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { model, ids } = body as { model: SoftDeleteModel; ids: number[] };

    if (!model || !VALID_MODELS.includes(model)) {
      return NextResponse.json(
        { error: `Modelo inválido. Opciones: ${VALID_MODELS.join(', ')}` },
        { status: 400 }
      );
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere un array de IDs para restaurar' },
        { status: 400 }
      );
    }

    if (ids.length > 100) {
      return NextResponse.json(
        { error: 'Máximo 100 registros por operación de restauración' },
        { status: 400 }
      );
    }

    const restored = await restoreRecords(model, ids);

    return NextResponse.json({
      success: true,
      message: `${restored.count} registro(s) de ${MODEL_LABELS[model]} restaurado(s)`,
      restoredCount: restored.count,
      restoredBy: user.name,
    });
  } catch (error) {
    console.error('Error restaurando registros:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Helpers para operaciones por modelo
async function getDeletedCount(model: SoftDeleteModel): Promise<number> {
  const delegate = prismaUnfiltered[getModelDelegate(model)] as any;
  return delegate.count({ where: { deletedAt: { not: null } } });
}

async function getDeletedRecords(model: SoftDeleteModel, skip: number, limit: number) {
  const delegate = prismaUnfiltered[getModelDelegate(model)] as any;

  const [records, total] = await Promise.all([
    delegate.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      skip,
      take: limit,
      select: getSelectFields(model),
    }),
    delegate.count({ where: { deletedAt: { not: null } } }),
  ]);

  return { records, total, totalPages: Math.ceil(total / limit) };
}

async function restoreRecords(model: SoftDeleteModel, ids: number[]) {
  const delegate = prismaUnfiltered[getModelDelegate(model)] as any;
  return delegate.updateMany({
    where: {
      id: { in: ids },
      deletedAt: { not: null },
    },
    data: {
      deletedAt: null,
      deletedBy: null,
    },
  });
}

function getModelDelegate(model: SoftDeleteModel): string {
  const map: Record<SoftDeleteModel, string> = {
    WorkOrder: 'workOrder',
    Task: 'task',
    FixedTask: 'fixedTask',
    MaintenanceChecklist: 'maintenanceChecklist',
  };
  return map[model];
}

function getSelectFields(model: SoftDeleteModel) {
  const base = { id: true, deletedAt: true, deletedBy: true, createdAt: true };

  switch (model) {
    case 'WorkOrder':
      return { ...base, title: true, status: true, priority: true, companyId: true };
    case 'Task':
      return { ...base, title: true, status: true, priority: true, companyId: true };
    case 'FixedTask':
      return { ...base, title: true, frequency: true, priority: true, companyId: true };
    case 'MaintenanceChecklist':
      return { ...base, title: true, frequency: true, isTemplate: true, companyId: true };
  }
}
