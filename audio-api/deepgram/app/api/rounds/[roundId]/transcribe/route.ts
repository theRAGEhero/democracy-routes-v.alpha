/**
 * Round-specific Transcription API Route
 * Triggers transcription for an assembled audio file from WebSocket streaming
 * Reads audio from public/audio/{roundId}.{ext} and processes via Deepgram
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@deepgram/sdk';
import { createDeliberationOntology } from '@/lib/deliberation/ontology';
import { saveTranscription, audioFileExists } from '@/lib/storage/files';
import { getRound, updateRound } from '@/lib/storage/rounds';
import { RoundStatus } from '@/types/round';
import { getLogger, createRequestId } from '@/lib/logging/logger';
import fs from 'fs/promises';
import path from 'path';

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
    const audioPath = await audioFileExists(roundId);
    if (!audioPath) {
      roundLog.warn('Audio file not found for round');
      return NextResponse.json(
        { error: 'Audio file not found. Recording may not have completed yet.' },
        { status: 404 }
      );
    }

    roundLog.info('Found audio file', { audioPath });

    // Update round status to processing
    await updateRound(roundId, { status: RoundStatus.PROCESSING });
    const language = round.language || 'en';

    // Read audio file from disk
    const fullPath = path.join(process.cwd(), 'public', audioPath);
    const buffer = await fs.readFile(fullPath);
    const extension = path.extname(audioPath).slice(1);
    const mimeType = extension === 'webm' ? 'audio/webm' : `audio/${extension}`;

    roundLog.info('Starting Deepgram transcription', {
      fileSize: buffer.length,
      mimeType,
      extension,
      language
    });

    // Initialize Deepgram client
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPGRAM_API_KEY not configured in environment variables');
    }

    const deepgram = createClient(apiKey);

    // Call Deepgram API with diarization enabled
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      buffer,
      {
        model: 'nova-2',
        language,
        diarize: true,
        punctuate: true,
        paragraphs: true,
        utterances: true,
        smart_format: true,
      }
    );

    // Check for Deepgram API errors
    if (error) {
      roundLog.error('Deepgram API error', {
        error: error,
        errorMessage: error.message || String(error)
      });
      throw new Error(`Deepgram API error: ${error.message || String(error)}`);
    }

    if (!result) {
      roundLog.error('Deepgram returned null result with no error');
      throw new Error('Deepgram API returned null result');
    }

    roundLog.debug('Raw result from Deepgram', {
      resultType: typeof result,
      resultKeys: result ? Object.keys(result) : [],
      hasResults: !!result?.results
    });

    roundLog.info('Deepgram transcription completed');

    // Convert response to plain object
    const responseDict = JSON.parse(JSON.stringify(result));

    // Validate response structure
    if (!responseDict || !responseDict.results) {
      roundLog.error('Invalid Deepgram response', {
        responseDict,
        responseType: typeof responseDict
      });
      throw new Error('Invalid response from Deepgram API');
    }

    // Create Deliberation Ontology format
    const filename = path.basename(audioPath);
    const deliberationData = createDeliberationOntology(responseDict, filename, language);

    // Save both raw and deliberation JSON files
    await saveTranscription(roundId, responseDict, deliberationData);

    roundLog.info('Transcription files saved successfully', {
      speakerCount: deliberationData.statistics.total_speakers,
      durationSeconds: deliberationData.statistics.duration_seconds
    });

    // Update round with completion status and metadata
    await updateRound(roundId, {
      status: RoundStatus.COMPLETED,
      audio_file: audioPath,
      transcription_file: `${roundId}_deliberation.json`,
      duration_seconds: deliberationData.statistics.duration_seconds,
      speaker_count: deliberationData.statistics.total_speakers
    });

    return NextResponse.json({
      success: true,
      roundId,
      deliberation: deliberationData,
      message: 'Transcription completed successfully'
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
