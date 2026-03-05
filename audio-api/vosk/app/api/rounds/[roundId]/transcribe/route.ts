/**
 * Round-specific Transcription API Route
 * Triggers transcription for an assembled audio file from WebSocket streaming
 * Reads audio from public/audio/{roundId}.{ext} and queues local VOSK processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { audioFileExists } from '@/lib/storage/files';
import { getRound, updateRound } from '@/lib/storage/rounds';
import { RoundStatus } from '@/types/round';
import { getLogger, createRequestId } from '@/lib/logging/logger';
import path from 'path';
import { enqueueTranscriptionJob, startTranscriptionWorker } from '@/lib/queue/transcription-queue';

const logger = getLogger('api.rounds.transcribe');

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes timeout for large files

interface RouteContext {
  params: {
    roundId: string;
  };
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const requestId = createRequestId();
  const log = logger.withContext({ requestId });

  const { roundId } = context.params;
  const roundLog = log.withContext({ roundId });

  try {
    // Validate round exists
    const round = await getRound(roundId);
    if (!round) {
      roundLog.warn('Round not found');
      return NextResponse.json(
        { error: 'Round not found' },
        { status: 404 }
      );
    }

    // Check if audio file exists
    const audioPath = round.audio_file || await audioFileExists(roundId);
    if (!audioPath) {
      roundLog.warn('Audio file not found for round');
      return NextResponse.json(
        { error: 'Audio file not found. Recording may not have completed yet.' },
        { status: 404 }
      );
    }

    roundLog.info('Found audio file', { audioPath });

    // Update round status to processing
    await updateRound(roundId, { status: RoundStatus.PROCESSING, audio_file: audioPath });

    const fullPath = path.join(process.cwd(), 'public', audioPath.replace(/^\//, ''));

    const job = await enqueueTranscriptionJob({
      roundId,
      audioPath: fullPath,
      source: 'recording'
    });

    await startTranscriptionWorker();

    return NextResponse.json({
      success: true,
      roundId,
      queued: true,
      jobId: job.id,
      message: 'Transcription queued'
    });

  } catch (error) {
    roundLog.error('Transcription error occurred', { error });

    // Update round status to error
    try {
      await updateRound(roundId, { status: RoundStatus.ERROR });
      roundLog.info('Updated round status to ERROR');
    } catch (updateError) {
      roundLog.warn('Failed to update round status', { error: updateError });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Transcription failed',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
