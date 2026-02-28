import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/shared-helpers';

// GET /api/google-drive/credentials
// Devuelve las credenciales públicas de Google Drive (API Key y Client ID)
export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;

  // Solo devolver si ambas están configuradas
  if (!apiKey || !clientId) {
    return NextResponse.json(
      { configured: false },
      { status: 200 }
    );
  }

  return NextResponse.json({
    configured: true,
    apiKey,
    clientId,
  });
}
