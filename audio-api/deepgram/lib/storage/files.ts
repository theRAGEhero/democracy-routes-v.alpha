/**
 * File storage utilities for transcriptions and audio files
 */

import fs from 'fs/promises';
import path from 'path';
import { DeliberationOntology } from '@/types/deliberation';
import { getLogger } from '@/lib/logging/logger';

const logger = getLogger('storage.files');

const DATA_DIR = path.join(process.cwd(), 'data');
const TRANSCRIPTIONS_DIR = path.join(DATA_DIR, 'transcriptions');
const AUDIO_DIR = path.join(process.cwd(), 'public', 'audio');

/**
 * Ensure required directories exist
 */
export async function ensureDirectories() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(TRANSCRIPTIONS_DIR, { recursive: true });
  await fs.mkdir(AUDIO_DIR, { recursive: true });
}

/**
 * Save both raw Deepgram response and Deliberation Ontology JSON
 * @param roundId - Unique round identifier
 * @param rawResponse - Raw Deepgram API response
 * @param deliberationData - Deliberation Ontology format data
 */
export async function saveTranscription(
  roundId: string,
  rawResponse: any,
  deliberationData: DeliberationOntology
) {
  logger.info('Saving transcription files', { roundId });

  try {
    await ensureDirectories();

    const rawPath = path.join(TRANSCRIPTIONS_DIR, `${roundId}_raw.json`);
    const deliberationPath = path.join(TRANSCRIPTIONS_DIR, `${roundId}_deliberation.json`);

    await fs.writeFile(rawPath, JSON.stringify(rawResponse, null, 2), 'utf-8');
    await fs.writeFile(deliberationPath, JSON.stringify(deliberationData, null, 2), 'utf-8');

    logger.info('Transcription files saved successfully', {
      roundId,
      rawPath,
      deliberationPath
    });

    return { rawPath, deliberationPath };
  } catch (error) {
    logger.error('Failed to save transcription files', { error, roundId });
    throw error;
  }
}

/**
 * Load Deliberation Ontology JSON for a round
 * @param roundId - Unique round identifier
 */
export async function loadDeliberationOntology(roundId: string): Promise<DeliberationOntology> {
  logger.debug('Loading deliberation ontology', { roundId });

  try {
    const filePath = path.join(TRANSCRIPTIONS_DIR, `${roundId}_deliberation.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    logger.info('Deliberation ontology loaded successfully', { roundId });
    return data;
  } catch (error) {
    logger.error('Failed to load deliberation ontology', { error, roundId });
    throw error;
  }
}

/**
 * Check if transcription exists for a round
 * @param roundId - Unique round identifier
 */
export async function transcriptionExists(roundId: string): Promise<boolean> {
  const filePath = path.join(TRANSCRIPTIONS_DIR, `${roundId}_deliberation.json`);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Save audio file to public directory
 * @param roundId - Unique round identifier
 * @param buffer - Audio file buffer
 * @param extension - File extension (e.g., 'webm', 'mp3')
 */
export async function saveAudioFile(
  roundId: string,
  buffer: Buffer,
  extension: string = 'webm'
): Promise<string> {
  logger.info('Saving audio file', { roundId, extension, size: buffer.length });

  try {
    await ensureDirectories();
    const filename = `${roundId}.${extension}`;
    const filePath = path.join(AUDIO_DIR, filename);
    await fs.writeFile(filePath, buffer);

    logger.info('Audio file saved successfully', { roundId, filename, path: filePath });
    return `/audio/${filename}`;
  } catch (error) {
    logger.error('Failed to save audio file', { error, roundId, extension });
    throw error;
  }
}

/**
 * Check if audio file exists for a round
 * @param roundId - Unique round identifier
 */
export async function audioFileExists(roundId: string): Promise<string | null> {
  const extensions = ['webm', 'mp3', 'wav', 'ogg'];

  for (const ext of extensions) {
    const filePath = path.join(AUDIO_DIR, `${roundId}.${ext}`);
    try {
      await fs.access(filePath);
      return `/audio/${roundId}.${ext}`;
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Delete all files related to a round
 * @param roundId - Unique round identifier
 */
export async function deleteRoundFiles(roundId: string): Promise<void> {
  logger.info('Deleting round files', { roundId });

  const filesToDelete = [
    path.join(TRANSCRIPTIONS_DIR, `${roundId}_raw.json`),
    path.join(TRANSCRIPTIONS_DIR, `${roundId}_deliberation.json`),
  ];

  // Try to delete audio files with various extensions
  const extensions = ['webm', 'mp3', 'wav', 'ogg'];
  for (const ext of extensions) {
    filesToDelete.push(path.join(AUDIO_DIR, `${roundId}.${ext}`));
  }

  const deletedFiles: string[] = [];
  const failedFiles: string[] = [];

  for (const filePath of filesToDelete) {
    try {
      await fs.unlink(filePath);
      deletedFiles.push(path.basename(filePath));
    } catch {
      // File might not exist, ignore error
      failedFiles.push(path.basename(filePath));
    }
  }

  logger.info('Round files deletion completed', {
    roundId,
    deletedCount: deletedFiles.length,
    failedCount: failedFiles.length,
    deletedFiles
  });
}

/**
 * Chunk management directory paths
 */
export const CHUNKS_DIR = path.join(DATA_DIR, 'chunks');

/**
 * Ensure chunk directory exists for a round
 */
export async function ensureChunkDirectory(roundId: string): Promise<string> {
  const chunkDir = path.join(CHUNKS_DIR, roundId);
  await fs.mkdir(chunkDir, { recursive: true });
  return chunkDir;
}

/**
 * Save a single audio chunk to disk
 */
export async function saveChunk(
  roundId: string,
  sequence: number,
  buffer: Buffer
): Promise<void> {
  const chunkDir = await ensureChunkDirectory(roundId);
  const filename = sequence.toString().padStart(4, '0') + '.webm';
  const filePath = path.join(chunkDir, filename);
  await fs.writeFile(filePath, buffer);

  logger.info('Chunk saved', { roundId, sequence, size: buffer.length });

  // Update manifest
  await updateChunkManifest(roundId, sequence);
}

/**
 * Assemble all chunks into a single audio file
 */
export async function assembleChunks(
  roundId: string,
  totalChunks: number,
  mimeType: string
): Promise<string> {
  logger.info('Assembling chunks', { roundId, totalChunks });

  const chunkDir = path.join(CHUNKS_DIR, roundId);
  const extension = mimeType.split('/')[1] || 'webm';
  const outputPath = path.join(AUDIO_DIR, `${roundId}.${extension}`);

  await ensureDirectories();

  // Create output file
  const chunks: Buffer[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const chunkFile = path.join(chunkDir, `${i.toString().padStart(4, '0')}.webm`);

    try {
      const chunkBuffer = await fs.readFile(chunkFile);
      chunks.push(chunkBuffer);
    } catch (error) {
      logger.error('Failed to read chunk', { roundId, sequence: i, error });
      throw new Error(`Missing chunk ${i}`);
    }
  }

  // Concatenate all chunks
  const finalBuffer = Buffer.concat(chunks);
  await fs.writeFile(outputPath, finalBuffer);

  logger.info('Chunks assembled successfully', { roundId, outputPath, size: finalBuffer.length });

  // Delete chunk directory
  await fs.rm(chunkDir, { recursive: true, force: true });

  return `/audio/${roundId}.${extension}`;
}

interface ChunkManifest {
  roundId: string;
  mimeType: string;
  totalChunks: number;
  receivedSequences: number[];
  startTime: number;
  lastUpdate: number;
}

/**
 * Update chunk manifest with a new received sequence
 */
export async function updateChunkManifest(
  roundId: string,
  sequence: number,
  mimeType: string = 'audio/webm'
): Promise<void> {
  const chunkDir = path.join(CHUNKS_DIR, roundId);
  const manifestPath = path.join(chunkDir, 'manifest.json');

  let manifest: ChunkManifest;
  try {
    const content = await fs.readFile(manifestPath, 'utf-8');
    manifest = JSON.parse(content);
  } catch {
    manifest = {
      roundId,
      mimeType,
      totalChunks: 0,
      receivedSequences: [],
      startTime: Date.now(),
      lastUpdate: Date.now()
    };
  }

  if (!manifest.receivedSequences.includes(sequence)) {
    manifest.receivedSequences.push(sequence);
    manifest.receivedSequences.sort((a, b) => a - b);
  }

  manifest.lastUpdate = Date.now();
  manifest.totalChunks = Math.max(manifest.totalChunks, sequence + 1);

  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * Get chunk manifest for a round
 */
export async function getChunkManifest(roundId: string): Promise<ChunkManifest | null> {
  try {
    const manifestPath = path.join(CHUNKS_DIR, roundId, 'manifest.json');
    const content = await fs.readFile(manifestPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Find missing chunks in a sequence
 */
export async function findMissingChunks(roundId: string, expectedTotal: number): Promise<number[]> {
  const manifest = await getChunkManifest(roundId);
  if (!manifest) return Array.from({ length: expectedTotal }, (_, i) => i);

  const missing: number[] = [];
  for (let i = 0; i < expectedTotal; i++) {
    if (!manifest.receivedSequences.includes(i)) {
      missing.push(i);
    }
  }
  return missing;
}
