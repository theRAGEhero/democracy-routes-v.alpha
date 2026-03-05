/**
 * Single Round API Routes
 * GET /api/rounds/[roundId] - Get specific round
 * PATCH /api/rounds/[roundId] - Update round
 * DELETE /api/rounds/[roundId] - Delete round and associated files
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRound, updateRound, deleteRound } from '@/lib/storage/rounds';
import { getLogger, createRequestId } from '@/lib/logging/logger';

const logger = getLogger('api.rounds.detail');

export async function GET(
  request: NextRequest,
  { params }: { params: { roundId: string } }
) {
  const requestId = createRequestId();
  const log = logger.withContext({ requestId, roundId: params.roundId });

  try {
    log.debug('Fetching round details');
    const round = await getRound(params.roundId);

    if (!round) {
      log.warn('Round not found');
      return NextResponse.json(
        { error: 'Round not found' },
        { status: 404 }
      );
    }

    log.info('Round fetched successfully', { status: round.status });
    return NextResponse.json({ round });

  } catch (error) {
    log.error('Error fetching round', { error });
    return NextResponse.json(
      { error: 'Failed to fetch round' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { roundId: string } }
) {
  const requestId = createRequestId();
  const log = logger.withContext({ requestId, roundId: params.roundId });

  try {
    const body = await request.json();
    log.info('Updating round', { updates: Object.keys(body) });

    const round = await updateRound(params.roundId, body);

    if (!round) {
      log.warn('Round not found for update');
      return NextResponse.json(
        { error: 'Round not found' },
        { status: 404 }
      );
    }

    log.info('Round updated successfully', { status: round.status });
    return NextResponse.json({ round });

  } catch (error) {
    log.error('Error updating round', { error });
    return NextResponse.json(
      { error: 'Failed to update round' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { roundId: string } }
) {
  const requestId = createRequestId();
  const log = logger.withContext({ requestId, roundId: params.roundId });

  try {
    log.info('Deleting round');
    const success = await deleteRound(params.roundId);

    if (!success) {
      log.warn('Round not found for deletion');
      return NextResponse.json(
        { error: 'Round not found' },
        { status: 404 }
      );
    }

    log.info('Round deleted successfully');
    return NextResponse.json({
      message: 'Round deleted successfully'
    });

  } catch (error) {
    log.error('Error deleting round', { error });
    return NextResponse.json(
      { error: 'Failed to delete round' },
      { status: 500 }
    );
  }
}
