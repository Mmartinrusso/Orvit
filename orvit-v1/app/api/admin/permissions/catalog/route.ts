import { NextResponse } from 'next/server';
import { PERMISSION_CATALOG, CATEGORY_LABELS } from '@/lib/permissions-catalog';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// GET /api/admin/permissions/catalog - Devuelve el catálogo completo bilingüe
export async function GET() {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const permissions = Object.entries(PERMISSION_CATALOG).map(([name, meta]) => ({
    name,
    es: meta.es,
    en: meta.en,
    category: meta.category,
    tags: meta.tags,
  }));

  const categories = Object.entries(CATEGORY_LABELS).map(([key, labels]) => ({
    key,
    es: labels.es,
    en: labels.en,
    count: permissions.filter(p => p.category === key).length,
  }));

  return NextResponse.json({
    success: true,
    permissions,
    categories,
    total: permissions.length,
  });
}
