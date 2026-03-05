import { NextResponse } from 'next/server';
import { startTranscriptionWorker } from '@/lib/queue/transcription-queue';

export const runtime = 'nodejs';

export async function POST() {
  await startTranscriptionWorker();
  return NextResponse.json({ started: true });
}
