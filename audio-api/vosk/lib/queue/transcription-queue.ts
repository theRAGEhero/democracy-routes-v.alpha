import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getLogger } from '@/lib/logging/logger';
import { transcribeWithVosk } from '@/lib/transcription/vosk';
import { saveTranscription, transcriptionExists } from '@/lib/storage/files';
import { getRound, updateRound } from '@/lib/storage/rounds';
import { RoundStatus } from '@/types/round';
import { createDeliberationOntology } from '@/lib/deliberation/ontology';

const logger = getLogger('queue.transcription');

const DATA_DIR = path.join(process.cwd(), 'data');
const QUEUE_DIR = path.join(DATA_DIR, 'queue');
const QUEUE_FILE = path.join(QUEUE_DIR, 'transcription.json');
const LOCK_FILE = path.join(QUEUE_DIR, 'transcription.lock');
const LOCK_TTL_MS = 10 * 60 * 1000;
const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 3;

export type TranscriptionJobStatus = 'queued' | 'processing' | 'completed' | 'error';

export interface TranscriptionJob {
  id: string;
  roundId: string;
  audioPath: string;
  source: 'recording' | 'upload';
  status: TranscriptionJobStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
}

interface QueueState {
  jobs: TranscriptionJob[];
}

let workerStarted = false;

async function ensureQueueFile() {
  await fs.mkdir(QUEUE_DIR, { recursive: true });
  try {
    await fs.access(QUEUE_FILE);
  } catch {
    await fs.writeFile(QUEUE_FILE, JSON.stringify({ jobs: [] }, null, 2), 'utf-8');
  }
}

async function readQueue(): Promise<QueueState> {
  await ensureQueueFile();
  const content = await fs.readFile(QUEUE_FILE, 'utf-8');
  return JSON.parse(content) as QueueState;
}

async function writeQueue(queue: QueueState) {
  await ensureQueueFile();
  const tempPath = `${QUEUE_FILE}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(queue, null, 2), 'utf-8');
  await fs.rename(tempPath, QUEUE_FILE);
}

async function acquireLock(): Promise<boolean> {
  await fs.mkdir(QUEUE_DIR, { recursive: true });
  try {
    const handle = await fs.open(LOCK_FILE, 'wx');
    await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: Date.now() }));
    await handle.close();
    return true;
  } catch {
    try {
      const content = await fs.readFile(LOCK_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Date.now() - parsed.startedAt > LOCK_TTL_MS) {
        await fs.unlink(LOCK_FILE);
        return acquireLock();
      }
    } catch {
      // Ignore lock read errors.
    }
    return false;
  }
}

async function releaseLock() {
  try {
    await fs.unlink(LOCK_FILE);
  } catch {
    // Ignore lock removal errors.
  }
}

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const maxRetries = 20;
  const retryDelayMs = 100;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const gotLock = await acquireLock();
    if (!gotLock) {
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      continue;
    }
    try {
      return await fn();
    } finally {
      await releaseLock();
    }
  }
  throw new Error('Queue lock timeout.');
}

function nowIso() {
  return new Date().toISOString();
}

export async function enqueueTranscriptionJob(input: {
  roundId: string;
  audioPath: string;
  source: 'recording' | 'upload';
}): Promise<TranscriptionJob> {
  return withLock(async () => {
    const queue = await readQueue();
    const existing = queue.jobs.find(job =>
      job.roundId === input.roundId &&
      (job.status === 'queued' || job.status === 'processing')
    );
    if (existing) {
      return existing;
    }

    const job: TranscriptionJob = {
      id: uuidv4(),
      roundId: input.roundId,
      audioPath: input.audioPath,
      source: input.source,
      status: 'queued',
      attempts: 0,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    queue.jobs.push(job);
    await writeQueue(queue);
    return job;
  });
}

async function updateJob(jobId: string, updates: Partial<TranscriptionJob>): Promise<TranscriptionJob | null> {
  return withLock(async () => {
    const queue = await readQueue();
    const index = queue.jobs.findIndex(job => job.id === jobId);
    if (index === -1) return null;
    const updated = { ...queue.jobs[index], ...updates, updatedAt: nowIso() };
    queue.jobs[index] = updated;
    await writeQueue(queue);
    return updated;
  });
}

async function claimNextJob(): Promise<TranscriptionJob | null> {
  return withLock(async () => {
    const queue = await readQueue();
    const next = queue.jobs.find(job => job.status === 'queued' && job.attempts < MAX_ATTEMPTS);
    if (!next) return null;
    next.status = 'processing';
    next.attempts += 1;
    next.updatedAt = nowIso();
    await writeQueue(queue);
    return next;
  });
}

async function recoverQueue() {
  await withLock(async () => {
    const queue = await readQueue();
    let updated = false;

    for (const job of queue.jobs) {
      if (job.status !== 'processing') continue;
      const done = await transcriptionExists(job.roundId);
      if (done) {
        job.status = 'completed';
        job.updatedAt = nowIso();
        updated = true;
        await updateRound(job.roundId, { status: RoundStatus.COMPLETED });
      } else if (job.attempts < MAX_ATTEMPTS) {
        job.status = 'queued';
        job.updatedAt = nowIso();
        updated = true;
      } else {
        job.status = 'error';
        job.updatedAt = nowIso();
        updated = true;
        await updateRound(job.roundId, { status: RoundStatus.ERROR });
      }
    }

    if (updated) {
      await writeQueue(queue);
    }
  });
}

async function processJob(job: TranscriptionJob) {
  const round = await getRound(job.roundId);
  if (!round) {
    await updateJob(job.id, { status: 'error', lastError: 'Round not found' });
    return;
  }

  const language = round.language || 'en';

  try {
    await fs.access(job.audioPath);
    const responseDict = await transcribeWithVosk(job.audioPath, language);
    const filename = path.basename(job.audioPath);
    const deliberationData = createDeliberationOntology(responseDict, filename, language);

    await saveTranscription(job.roundId, responseDict, deliberationData);

    await updateRound(job.roundId, {
      status: RoundStatus.COMPLETED,
      transcription_file: `${job.roundId}_deliberation.json`,
      duration_seconds: deliberationData.statistics.duration_seconds,
      speaker_count: deliberationData.statistics.total_speakers
    });

    await updateJob(job.id, { status: 'completed', lastError: undefined });
    logger.info('Transcription completed', { jobId: job.id, roundId: job.roundId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown transcription error';
    await updateRound(job.roundId, { status: RoundStatus.ERROR });
    await updateJob(job.id, { status: 'error', lastError: message });
    logger.error('Transcription failed', { jobId: job.id, roundId: job.roundId, error: message });
  }
}

export async function startTranscriptionWorker(): Promise<void> {
  if (workerStarted) return;
  workerStarted = true;

  await recoverQueue();

  const loop = async () => {
    while (true) {
      try {
        const job = await claimNextJob();
        if (!job) {
          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
          continue;
        }
        await processJob(job);
      } catch (error) {
        logger.error('Worker loop error', { error });
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }
  };

  loop().catch(error => {
    logger.error('Worker failed to start', { error });
    workerStarted = false;
  });
}

export async function getQueueSnapshot(): Promise<QueueState> {
  return readQueue();
}
