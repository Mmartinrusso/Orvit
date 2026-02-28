import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildPermissionAssistantMessages } from '@/lib/ai/permission-assistant-prompt';
import { PERMISSION_CATALOG } from '@/lib/permissions-catalog';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// OpenAI client singleton
let openaiClient: any = null;

async function getOpenAIClient() {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY no está configurada');
    }
    const OpenAI = (await import('openai')).default;
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

async function getUserFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: { include: { company: true, role: true } },
        ownedCompanies: true,
      },
    });
  } catch {
    return null;
  }
}

function isAdminRole(
  systemRole: string,
  companyRoleName: string | null | undefined,
  companyRoleDisplayName: string | null | undefined
): boolean {
  const systemAdminRoles = ['SUPERADMIN', 'ADMIN', 'ADMIN_ENTERPRISE'];
  if (systemAdminRoles.includes(systemRole)) return true;
  if (!companyRoleName && !companyRoleDisplayName) return false;
  const normalizedRoleName = (companyRoleName || '').trim().toUpperCase();
  const normalizedDisplayName = (companyRoleDisplayName || '').trim().toUpperCase();
  const adminKeywords = ['ADMINISTRADOR', 'ADMIN', 'ADMINISTRATOR', 'ADMIN EMPRESA', 'ADMIN_EMPRESA'];
  return adminKeywords.some(
    keyword =>
      normalizedRoleName.includes(keyword) ||
      normalizedDisplayName.includes(keyword)
  );
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que es admin
    const companyId =
      user.ownedCompanies?.[0]?.id || user.companies?.[0]?.company.id;
    if (!companyId) {
      return NextResponse.json({ error: 'Sin empresa asociada' }, { status: 403 });
    }
    const userCompany = user.companies?.find(uc => uc.company.id === companyId);
    const hasAccess = isAdminRole(
      user.role,
      userCompany?.role?.name,
      userCompany?.role?.displayName
    );
    if (!hasAccess) {
      return NextResponse.json({ error: 'Sin permisos de administrador' }, { status: 403 });
    }

    const body = await request.json();
    const { prompt, currentPermissions = [], roleName, conversationHistory } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'Se requiere un mensaje para el asistente' },
        { status: 400 }
      );
    }

    // Construir mensajes para OpenAI
    const messages = buildPermissionAssistantMessages(
      prompt.trim(),
      currentPermissions,
      roleName,
      conversationHistory
    );

    // Llamar a OpenAI
    const openai = await getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: 'Sin respuesta del asistente' },
        { status: 500 }
      );
    }

    // Parsear respuesta
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: 'Respuesta inválida del asistente', raw: content },
        { status: 500 }
      );
    }

    // Validar y enriquecer sugerencias
    const validSuggestions = (parsed.suggestions || [])
      .filter((s: any) => s.permission && PERMISSION_CATALOG[s.permission])
      .map((s: any) => ({
        permission: s.permission,
        reason: s.reason || '',
        confidence: ['high', 'medium', 'low'].includes(s.confidence)
          ? s.confidence
          : 'medium',
        alreadyAssigned: currentPermissions.includes(s.permission),
        descriptionEs: PERMISSION_CATALOG[s.permission]?.es || s.permission,
        descriptionEn: PERMISSION_CATALOG[s.permission]?.en || s.permission,
        category: PERMISSION_CATALOG[s.permission]?.category || 'otros',
      }));

    return NextResponse.json({
      success: true,
      suggestions: validSuggestions,
      message: parsed.message || 'Sugerencias generadas',
      tokensUsed: completion.usage?.total_tokens || 0,
    });
  } catch (error: any) {
    console.error('Error en AI suggest:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del asistente' },
      { status: 500 }
    );
  }
}
