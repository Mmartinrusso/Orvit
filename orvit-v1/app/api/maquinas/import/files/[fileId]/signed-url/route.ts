/**
 * GET /api/maquinas/import/files/[fileId]/signed-url
 *
 * Generate a signed URL for accessing an import file from S3
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// S3 Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const S3_BUCKET = process.env.AWS_S3_BUCKET || 'mawir-bucket';

// Helper para obtener el usuario actual
async function getCurrentUser() {
  try {
    const token = (await cookies()).get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: { include: { company: true } },
        ownedCompanies: true,
      },
    });

    if (!user) return null;

    const company = user.ownedCompanies[0] || user.companies[0]?.company;
    return { user, company };
  } catch {
    return null;
  }
}

// =============================================================================
// GET: Generate signed URL
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const auth = await getCurrentUser();
    if (!auth || !auth.company) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { fileId } = await params;
    const id = parseInt(fileId);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Get file with job info
    const file = await prisma.machineImportFile.findUnique({
      where: { id },
      include: {
        importJob: {
          select: {
            id: true,
            companyId: true,
          },
        },
      },
    });

    if (!file) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

    // Verify company access
    if (file.importJob.companyId !== auth.company.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Generate signed URL (valid for 15 minutes)
    const expiresIn = 15 * 60; // 15 minutes in seconds
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: file.s3Key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    return NextResponse.json({
      url: signedUrl,
      fileName: file.fileName,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      expiresAt: expiresAt.toISOString(),
    });

  } catch (error) {
    console.error('Error generating signed URL:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
