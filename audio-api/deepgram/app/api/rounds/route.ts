/**
 * Rounds API Routes
 * GET /api/rounds - List all rounds
 * POST /api/rounds - Create new round
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getRounds, createRound } from '@/lib/storage/rounds';
import { Round, RoundStatus } from '@/types/round';
import { getLogger, createRequestId } from '@/lib/logging/logger';
import { DEFAULT_DEEPGRAM_LANGUAGE, isDeepgramLanguage } from '@/lib/deepgram/languages';

const logger = getLogger('api.rounds');

export async function GET() {
  const requestId = createRequestId();
  const log = logger.withContext({ requestId });

  try {
    log.debug('Fetching all rounds');
    const rounds = await getRounds();
    log.info('Rounds fetched successfully', { count: rounds.length });
    return NextResponse.json({ rounds });
  } catch (error) {
    log.error('Error fetching rounds', { error });
    return NextResponse.json(
      { error: 'Failed to fetch rounds' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const log = logger.withContext({ requestId });

  try {
    const body = await request.json();
    const { name, description, language } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      log.warn('Invalid round name provided', { name });
      return NextResponse.json(
        { error: 'Name is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    const normalizedLanguage = typeof language === 'string' && language.trim().length > 0
      ? language.trim()
      : DEFAULT_DEEPGRAM_LANGUAGE;

    if (!isDeepgramLanguage(normalizedLanguage)) {
      log.warn('Invalid language provided', { language: normalizedLanguage });
      return NextResponse.json(
        { error: 'Language is not supported' },
        { status: 400 }
      );
    }

    const round: Round = {
      id: uuidv4(),
      name: name.trim(),
      description: description?.trim() || undefined,
      created_at: new Date().toISOString(),
      status: RoundStatus.CREATED,
      language: normalizedLanguage
    };

    log.info('Creating new round', { roundId: round.id, name: round.name });
    const createdRound = await createRound(round);
    log.info('Round created successfully', { roundId: createdRound.id });

    return NextResponse.json({
      round: createdRound,
      message: 'Round created successfully'
    }, { status: 201 });

  } catch (error) {
    log.error('Error creating round', { error });
    return NextResponse.json(
      { error: 'Failed to create round' },
      { status: 500 }
    );
  }
}
