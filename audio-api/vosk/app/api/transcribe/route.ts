/**
 * Transcription API Route
 * Accepts audio file, queues local VOSK transcription, returns queue status
 */

import { NextRequest, NextResponse } from 'next/server';
import { saveAudioFile } from '@/lib/storage/files';
import { getRound, updateRound } from '@/lib/storage/rounds';
import { RoundStatus } from '@/types/round';
import { getLogger, createRequestId } from '@/lib/logging/logger';
import { enqueueTranscriptionJob, startTranscriptionWorker } from '@/lib/queue/transcription-queue';
import path from 'path';

const logger = getLogger('api.transcribe');

export const runtime = 'nodejs'; // Required for file system operations
export const maxDuration = 300; // 5 minutes timeout for large files

export async function POST(request: NextRequest) {
  // Create request-scoped logger
  const requestId = createRequestId();
  const log = logger.withContext({ requestId });

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const roundId = formData.get('roundId') as string;
    const filename = formData.get('filename') as string || audioFile?.name || 'audio';

    // Add roundId to logger context
    const roundLog = log.withContext({ roundId });

    if (!audioFile) {
      roundLog.warn('No audio file provided in request');
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    if (!roundId) {
      log.warn('No round ID provided in request');
      return NextResponse.json(
        { error: 'Round ID is required' },
        { status: 400 }
      );
    }

    const round = await getRound(roundId);
    if (!round) {
      roundLog.warn('Round not found');
      return NextResponse.json(
        { error: 'Round not found' },
        { status: 404 }
      );
    }

    // Update round status to processing
    await updateRound(roundId, { status: RoundStatus.PROCESSING });

    // Convert File to Buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const extension = path.extname(filename).slice(1) || audioFile.type?.split('/')[1] || 'webm';
    const audioPath = await saveAudioFile(roundId, buffer, extension);
    const fullAudioPath = path.join(process.cwd(), 'public', audioPath.replace(/^\//, ''));

    roundLog.info('Queued VOSK transcription', {
      filename,
      fileSize: audioFile.size,
      mimeType: audioFile.type
    });

    await updateRound(roundId, { audio_file: audioPath });

    const job = await enqueueTranscriptionJob({
      roundId,
      audioPath: fullAudioPath,
      source: 'upload'
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
    log.error('Transcription error occurred', { error });

    // Try to update round status to error if we have roundId
    try {
      const formData = await request.clone().formData();
      const roundId = formData.get('roundId') as string;
      if (roundId) {
        await updateRound(roundId, { status: RoundStatus.ERROR });
        log.info('Updated round status to ERROR', { roundId });
      }
    } catch (updateError) {
      log.warn('Failed to update round status', { error: updateError });
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
