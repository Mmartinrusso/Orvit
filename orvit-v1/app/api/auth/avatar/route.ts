/**
 * POST /api/auth/avatar — Upload profile photo
 * DELETE /api/auth/avatar — Remove profile photo
 */

import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/prisma";
import { getAuthPayload } from "@/lib/chat/auth";
import { deleteS3File } from "@/lib/s3-utils";

export const dynamic = "force-dynamic";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET!;
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export async function POST(request: NextRequest) {
  const auth = await getAuthPayload(request);
  if (!auth) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No se subio imagen" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Imagen muy grande. Maximo 5MB" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Solo JPG, PNG o WebP" }, { status: 400 });
    }

    // Delete old avatar from S3 if exists
    const currentUser = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { avatar: true },
    });
    if (currentUser?.avatar) {
      deleteS3File(currentUser.avatar).catch(() => {});
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const s3Key = `avatars/${auth.userId}/${uuidv4()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: file.type,
      })
    );

    const region = process.env.AWS_REGION;
    const url = `https://${BUCKET}.s3.${region}.amazonaws.com/${s3Key}`;

    await prisma.user.update({
      where: { id: auth.userId },
      data: { avatar: url },
    });

    return NextResponse.json({ avatar: url });
  } catch (error) {
    console.error("[avatar-upload] Error:", error);
    return NextResponse.json({ error: "Error al subir imagen" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthPayload(request);
  if (!auth) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { avatar: true },
  });

  if (user?.avatar) {
    deleteS3File(user.avatar).catch(() => {});
  }

  await prisma.user.update({
    where: { id: auth.userId },
    data: { avatar: null },
  });

  return NextResponse.json({ ok: true });
}
