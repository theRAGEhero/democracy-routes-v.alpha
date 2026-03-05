/**
 * Transcription API Route
 * Accepts audio file, sends to Deepgram, returns Deliberation Ontology JSON
 * Ported from Podfree-Editor: deepgram_transcribe_debates.py lines 338-448
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@deepgram/sdk';
import { createDeliberationOntology } from '@/lib/deliberation/ontology';
import { saveTranscription } from '@/lib/storage/files';
import { getRound, updateRound } from '@/lib/storage/rounds';
import { RoundStatus } from '@/types/round';
import { getLogger, createRequestId } from '@/lib/logging/logger';

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
    const language = round?.language || 'en';

    // Update round status to processing
    await updateRound(roundId, { status: RoundStatus.PROCESSING });

    // Initialize Deepgram client
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPGRAM_API_KEY not configured in environment variables');
    }

    const deepgram = createClient(apiKey);

    // Convert File to Buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    roundLog.info('Starting Deepgram transcription', {
      filename,
      fileSize: audioFile.size,
      mimeType: audioFile.type,
      language
    });

    // Call Deepgram API with diarization enabled
    // Configuration matches Podfree-Editor: lines 360-384
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      buffer,
      {
        model: 'nova-2',        // Latest Deepgram model
        language,               // Selected transcription language
        diarize: true,          // ← Critical: Enable speaker identification
        punctuate: true,        // Add punctuation automatically
        paragraphs: true,       // Detect paragraph breaks
        utterances: true,       // Detect utterances/sentence boundaries
        smart_format: true,     // Format numbers, currency, etc.
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

    // Debug: Log what result looks like before serialization
    roundLog.debug('Raw result from Deepgram', {
      resultType: typeof result,
      resultKeys: result ? Object.keys(result) : [],
      resultConstructor: result?.constructor?.name,
      hasResults: !!result?.results
    });

    roundLog.info('Deepgram transcription completed');

    // Convert response to plain object
    const responseDict = JSON.parse(JSON.stringify(result));

    // Debug: Log response structure after serialization
    roundLog.debug('Deepgram response after serialization', {
      responseDictType: typeof responseDict,
      responseDictIsNull: responseDict === null,
      hasResults: !!responseDict?.results,
      responsePreview: JSON.stringify(responseDict).substring(0, 200)
    });

    // Validate response structure
    if (!responseDict || !responseDict.results) {
      roundLog.error('Invalid Deepgram response', {
        responseDict,
        responseType: typeof responseDict
      });
      throw new Error('Invalid response from Deepgram API');
    }

    // Create Deliberation Ontology format
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
