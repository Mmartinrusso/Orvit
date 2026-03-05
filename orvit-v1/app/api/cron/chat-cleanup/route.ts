/**
 * GET /api/cron/chat-cleanup
 *
 * Deletes chat messages (and their S3 files) older than each company's
 * configured retentionDays.  Runs as a daily cron.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteS3Files } from "@/lib/s3-utils";

export const dynamic = "force-dynamic";

const BATCH_SIZE = 500;

export async function GET(_request: NextRequest) {
  try {
    // Get all companies with storage config
    const configs = await prisma.chatStorageUsage.findMany({
      where: { retentionDays: { gt: 0 } },
      select: { companyId: true, retentionDays: true },
    });

    let totalDeleted = 0;
    let totalFilesDeleted = 0;

    for (const config of configs) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - config.retentionDays);

      // Process in batches to avoid memory issues
      let hasMore = true;
      while (hasMore) {
        const oldMessages = await prisma.message.findMany({
          where: {
            companyId: config.companyId,
            createdAt: { lt: cutoff },
            isDeleted: false,
          },
          select: { id: true, fileUrl: true, fileSize: true },
          take: BATCH_SIZE,
        });

        if (oldMessages.length === 0) {
          hasMore = false;
          break;
        }

        // Collect S3 URLs to delete
        const fileUrls = oldMessages
          .filter((m) => m.fileUrl)
          .map((m) => m.fileUrl!);

        const totalFileBytes = oldMessages
          .filter((m) => m.fileSize)
          .reduce((sum, m) => sum + (m.fileSize || 0), 0);

        // Soft-delete messages and clear file references
        const ids = oldMessages.map((m) => m.id);
        await prisma.message.updateMany({
          where: { id: { in: ids } },
          data: {
            isDeleted: true,
            content: "",
            fileUrl: null,
            fileName: null,
            fileSize: null,
            fileDuration: null,
          },
        });

        // Delete S3 files in bulk
        if (fileUrls.length > 0) {
          const result = await deleteS3Files(fileUrls);
          totalFilesDeleted += result.deleted;
        }

        // Decrement storage usage
        if (totalFileBytes > 0) {
          await prisma.chatStorageUsage.update({
            where: { companyId: config.companyId },
            data: { usedBytes: { decrement: BigInt(totalFileBytes) } },
          }).catch(() => {});
        }

        totalDeleted += oldMessages.length;

        if (oldMessages.length < BATCH_SIZE) {
          hasMore = false;
        }
      }
    }

    console.log(
      `[chat-cleanup] Done: ${totalDeleted} messages cleaned, ${totalFilesDeleted} files deleted across ${configs.length} companies`
    );

    return NextResponse.json({
      success: true,
      messagesDeleted: totalDeleted,
      filesDeleted: totalFilesDeleted,
      companiesProcessed: configs.length,
    });
  } catch (error) {
    console.error("[chat-cleanup] Error:", error);
    return NextResponse.json(
      { error: "Error en limpieza de chat" },
      { status: 500 }
    );
  }
}
