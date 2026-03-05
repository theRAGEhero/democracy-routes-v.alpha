import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { getRound } from '@/lib/storage/rounds';
import { getLogger, createRequestId } from '@/lib/logging/logger';

const logger = getLogger('api.rounds.qr');

export const runtime = 'nodejs';

interface RouteContext {
  params: {
    roundId: string;
  };
}

function buildRoundUrl(request: NextRequest, roundId: string) {
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  const baseUrl = host ? `${protocol}://${host}` : 'http://localhost:3000';
  return `${baseUrl}/rounds/${roundId}`;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const requestId = createRequestId();
  const log = logger.withContext({ requestId });
  const { roundId } = context.params;

  try {
    const round = await getRound(roundId);
    if (!round) {
      log.warn('Round not found for QR', { roundId });
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    const url = buildRoundUrl(request, roundId);
    const pngBuffer = await QRCode.toBuffer(url, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320
    });

    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (error) {
    log.error('Failed to generate QR code', { error, roundId });
    return NextResponse.json({ error: 'Failed to generate QR code' }, { status: 500 });
  }
}
