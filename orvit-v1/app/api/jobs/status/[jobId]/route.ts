/**
 * Job Status API
 * GET /api/jobs/status/[jobId]?queue=queue-name
 * Returns the status of a background job
 */

import { NextRequest, NextResponse } from 'next/server';
import { getJobStatus, QUEUE_NAMES, type QueueName } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const { searchParams } = new URL(request.url);
    const queueName = searchParams.get('queue') as QueueName | null;

    if (!queueName || !Object.values(QUEUE_NAMES).includes(queueName)) {
      return NextResponse.json(
        { error: 'Invalid or missing queue parameter' },
        { status: 400 }
      );
    }

    const status = await getJobStatus(queueName, jobId);

    if (!status) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error('Error getting job status:', error);
    return NextResponse.json(
      { error: 'Failed to get job status' },
      { status: 500 }
    );
  }
}
