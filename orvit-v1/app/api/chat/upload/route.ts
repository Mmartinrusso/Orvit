/**
 * POST /api/chat/upload — Upload file for chat (audio, image, document)
 *
 * Accepts multipart form data with a single file.
 * Returns S3 URL + metadata for creating a message.
 */

import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { getAuthPayload } from "@/lib/chat/auth";

export const dynamic = "force-dynamic";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET!;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const ALLOWED_TYPES: Record<string, string[]> = {
  audio: [
    "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/mpeg", "audio/ogg",
    "audio/wav", "audio/webm", "audio/aac",
  ],
  image: [
    "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
  ],
  file: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "application/zip",
  ],
};

function detectCategory(mimeType: string): "audio" | "image" | "file" | null {
  for (const [cat, types] of Object.entries(ALLOWED_TYPES)) {
    if (types.includes(mimeType)) return cat as "audio" | "image" | "file";
  }
  return null;
}

export async function POST(request: NextRequest) {
  const auth = await getAuthPayload(request);
  if (!auth || !auth.companyId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const duration = formData.get("duration") as string | null; // seconds, for audio

    if (!file) {
      return NextResponse.json({ error: "No se subió ningún archivo" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "El archivo es demasiado grande. Máximo 25MB" },
        { status: 400 }
      );
    }

    const category = detectCategory(file.type);
    if (!category) {
      return NextResponse.json(
        { error: "Tipo de archivo no permitido" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const s3Key = `chat/${category}/${auth.companyId}/${Date.now()}-${uuidv4()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: file.type,
        Metadata: {
          "user-id": String(auth.userId),
          "company-id": String(auth.companyId),
          "original-name": file.name,
          category,
        },
      })
    );

    const region = process.env.AWS_REGION;
    const url = `https://${BUCKET}.s3.${region}.amazonaws.com/${s3Key}`;

    return NextResponse.json({
      url,
      fileName: file.name,
      fileSize: file.size,
      fileDuration: duration ? parseFloat(duration) : null,
      type: category, // "audio" | "image" | "file"
    });
  } catch (error) {
    console.error("[chat-upload] Error:", error);
    return NextResponse.json(
      { error: "Error al subir archivo" },
      { status: 500 }
    );
  }
}
