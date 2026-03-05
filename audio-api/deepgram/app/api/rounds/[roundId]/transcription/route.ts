/**
 * Transcription retrieval API route
 * Serves the deliberation ontology JSON for a specific round
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadDeliberationOntology, transcriptionExists } from '@/lib/storage/files';
import { getRound } from '@/lib/storage/rounds';
import { getLogger, createRequestId } from '@/lib/logging/logger';

const logger = getLogger('api.rounds.transcription');

export async function GET(
  request: NextRequest,
  { params }: { params: { roundId: string } }
) {
  const requestId = createRequestId();
  const log = logger.withContext({ requestId, roundId: params.roundId });

  try {
    log.debug('Fetching transcription for round');

    // Verify round exists
    const round = await getRound(params.roundId);
    if (!round) {
      log.warn('Round not found');
      return NextResponse.json(
        { error: 'Round not found' },
        { status: 404 }
      );
    }

    // Check if transcription file exists
    const exists = await transcriptionExists(params.roundId);
    if (!exists) {
      log.warn('Transcription file not found for round');
      return NextResponse.json(
        { error: 'Transcription not found for this round' },
        { status: 404 }
      );
    }

    // Load and return the deliberation ontology
    const deliberationData = await loadDeliberationOntology(params.roundId);

    log.info('Transcription retrieved successfully', {
      speakerCount: deliberationData.statistics.total_speakers,
      contributionCount: deliberationData.statistics.total_contributions
    });

    return NextResponse.json(deliberationData, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
      }
    });

  } catch (error) {
    log.error('Failed to retrieve transcription', { error });

    return NextResponse.json(
      {
        error: 'Failed to load transcription',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
