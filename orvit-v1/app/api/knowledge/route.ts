import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// GET: List knowledge articles
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('knowledge.view');
    if (error) return error;

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
    const { user, error } = await requirePermission('knowledge.create');
    if (error) return error;

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
        ${tags || []}, ${machineId || null}, ${componentId || null}, ${status || 'DRAFT'}, ${user!.id},
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

// PUT: Update knowledge article (edit, publish, review)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action } = body;

    if (!id) {
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
    }

    // Determine required permission based on action
    let permissionName = 'knowledge.edit';
    if (action === 'publish') permissionName = 'knowledge.publish';
    else if (action === 'review') permissionName = 'knowledge.review';

    const { user, error } = await requirePermission(permissionName);
    if (error) return error;

    const companyId = user!.companyId;

    // Verify ownership
    const existing = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM "KnowledgeArticle" WHERE id = ${id} AND "companyId" = ${companyId}
    `;
    if (!existing.length) {
      return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 });
    }

    if (action === 'publish') {
      await prisma.$executeRaw`
        UPDATE "KnowledgeArticle" SET
          status = 'PUBLISHED',
          "publishedAt" = NOW(),
          "updatedAt" = NOW()
        WHERE id = ${id} AND "companyId" = ${companyId}
      `;
      return NextResponse.json({ success: true });
    }

    if (action === 'review') {
      await prisma.$executeRaw`
        UPDATE "KnowledgeArticle" SET
          "reviewedById" = ${user!.id},
          "reviewedAt" = NOW(),
          "updatedAt" = NOW()
        WHERE id = ${id} AND "companyId" = ${companyId}
      `;
      return NextResponse.json({ success: true });
    }

    // Default: edit
    const { title, content, summary, category, tags, machineId, componentId, status } = body;

    await prisma.$executeRaw`
      UPDATE "KnowledgeArticle" SET
        title = COALESCE(${title || null}, title),
        content = COALESCE(${content || null}, content),
        summary = ${summary || null},
        category = COALESCE(${category || null}, category),
        tags = COALESCE(${tags || null}, tags),
        "machineId" = ${machineId || null},
        "componentId" = ${componentId || null},
        status = COALESCE(${status || null}, status),
        "updatedAt" = NOW()
      WHERE id = ${id} AND "companyId" = ${companyId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating knowledge article:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE: Delete knowledge article
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('knowledge.delete');
    if (error) return error;

    const companyId = user!.companyId;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM "KnowledgeArticle" WHERE id = ${parseInt(id)} AND "companyId" = ${companyId}
    `;
    if (!existing.length) {
      return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 });
    }

    // Delete attachments first
    await prisma.$executeRaw`
      DELETE FROM "KnowledgeAttachment" WHERE "articleId" = ${parseInt(id)}
    `;
    // Delete the article
    await prisma.$executeRaw`
      DELETE FROM "KnowledgeArticle" WHERE id = ${parseInt(id)} AND "companyId" = ${companyId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting knowledge article:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
