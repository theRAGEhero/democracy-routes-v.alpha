import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'Stream stats are served by the Node server. Use /api/stream-audio/stats on the same host.' },
    { status: 503 }
  );
}
