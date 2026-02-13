import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET: List knowledge articles
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = parseInt(searchParams.get('companyId') || '0');
    const category = searchParams.get('category');
    const machineId = searchParams.get('machineId');
    const search = searchParams.get('search');
    const status = searchParams.get('status') || 'PUBLISHED';

    if (!companyId) {
      return NextResponse.json({ error: 'companyId requerido' }, { status: 400 });
    }

    let whereClause = `WHERE ka."companyId" = ${companyId}`;
    if (category && category !== 'all') whereClause += ` AND ka.category = '${category}'`;
    if (machineId) whereClause += ` AND ka."machineId" = ${parseInt(machineId)}`;
    if (status && status !== 'all') whereClause += ` AND ka.status = '${status}'`;
    if (search) whereClause += ` AND (ka.title ILIKE '%${search}%' OR ka.content ILIKE '%${search}%')`;

    const articles = await prisma.$queryRaw`
      SELECT
        ka.*,
        m.name as machine_name,
        u.name as author_name,
        ur.name as reviewed_by_name,
        (SELECT COUNT(*) FROM "KnowledgeAttachment" att WHERE att."articleId" = ka.id) as attachment_count
      FROM "KnowledgeArticle" ka
      LEFT JOIN "Machine" m ON ka."machineId" = m.id
      LEFT JOIN "User" u ON ka."authorId" = u.id
      LEFT JOIN "User" ur ON ka."reviewedById" = ur.id
      ${prisma.$queryRaw`${prisma.raw(whereClause)}`}
      ORDER BY ka."updatedAt" DESC
      LIMIT 100
    `;

    // Get categories for filter
    const categories = await prisma.$queryRaw`
      SELECT DISTINCT category, COUNT(*) as count
      FROM "KnowledgeArticle"
      WHERE "companyId" = ${companyId} AND category IS NOT NULL
      GROUP BY category
    `;

    return NextResponse.json({ articles, categories });
  } catch (error) {
    console.error('Error fetching knowledge articles:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST: Create knowledge article
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const body = await request.json();
    const {
      companyId,
      title,
      content,
      summary,
      category,
      tags,
      machineId,
      componentId,
      status,
    } = body;

    if (!companyId || !title || !content) {
      return NextResponse.json(
        { error: 'companyId, title y content son requeridos' },
        { status: 400 }
      );
    }

    // Generate slug
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const result = await prisma.$queryRaw<{ id: number }[]>`
      INSERT INTO "KnowledgeArticle" (
        "companyId", "title", "slug", "content", "summary", "category",
        "tags", "machineId", "componentId", "status", "authorId",
        "createdAt", "updatedAt"
      ) VALUES (
        ${companyId}, ${title}, ${slug}, ${content}, ${summary || null}, ${category || null},
        ${tags || []}, ${machineId || null}, ${componentId || null}, ${status || 'DRAFT'}, ${payload.userId},
        NOW(), NOW()
      )
      RETURNING id
    `;

    return NextResponse.json({ success: true, id: result[0]?.id }, { status: 201 });
  } catch (error) {
    console.error('Error creating knowledge article:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
