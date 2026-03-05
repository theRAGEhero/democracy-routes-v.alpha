/**
 * Cleanup job for orphaned audio chunks
 * Detects and removes chunk directories that are older than the threshold
 * and haven't been successfully assembled
 */

import fs from 'fs/promises';
import path from 'path';
import { CHUNKS_DIR, getChunkManifest } from '@/lib/storage/files';
import { getRound, updateRound } from '@/lib/storage/rounds';
import { RoundStatus } from '@/types/round';
import { getLogger } from '@/lib/logging/logger';

const logger = getLogger('maintenance.cleanup-chunks');

// Chunk directories older than this will be considered orphaned
const ORPHAN_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface CleanupResult {
  scanned: number;
  orphaned: number;
  deleted: number;
  errors: string[];
}

/**
 * Scan for and cleanup orphaned chunk directories
 */
export async function cleanupOrphanedChunks(): Promise<CleanupResult> {
  logger.info('Starting orphaned chunks cleanup');

  const result: CleanupResult = {
    scanned: 0,
    orphaned: 0,
    deleted: 0,
    errors: []
  };

  try {
    // Ensure chunks directory exists
    try {
      await fs.access(CHUNKS_DIR);
    } catch {
      logger.info('Chunks directory does not exist, nothing to cleanup');
      return result;
    }

    // Get all chunk directories
    const entries = await fs.readdir(CHUNKS_DIR, { withFileTypes: true });
    const directories = entries.filter(entry => entry.isDirectory());

    logger.info('Scanning chunk directories', { count: directories.length });

    for (const dir of directories) {
      result.scanned++;
      const roundId = dir.name;
      const chunkDir = path.join(CHUNKS_DIR, roundId);

      try {
        // Get manifest to check last update time
        const manifest = await getChunkManifest(roundId);

        if (!manifest) {
          logger.warn('No manifest found for chunk directory', { roundId });
          continue;
        }

        const now = Date.now();
        const age = now - manifest.lastUpdate;

        // Check if directory is older than threshold
        if (age < ORPHAN_THRESHOLD_MS) {
          logger.debug('Chunk directory is recent, skipping', {
            roundId,
            ageMinutes: Math.floor(age / 60000)
          });
          continue;
        }

        // Check round status
        const round = await getRound(roundId);

        if (!round) {
          logger.warn('Round not found for chunk directory', { roundId });
          result.orphaned++;
          await deleteChunkDirectory(chunkDir, roundId);
          result.deleted++;
          continue;
        }

        // If round is completed, chunks should have been deleted already
        // If still present, it's orphaned
        if (round.status === RoundStatus.COMPLETED) {
          logger.warn('Orphaned chunks found for completed round', { roundId });
          result.orphaned++;
          await deleteChunkDirectory(chunkDir, roundId);
          result.deleted++;
          continue;
        }

        // If round is still in streaming or created status but chunks are old, it's orphaned
        if (round.status === RoundStatus.STREAMING || round.status === RoundStatus.CREATED) {
          logger.warn('Orphaned chunks found for stale round', {
            roundId,
            status: round.status,
            ageHours: Math.floor(age / 3600000)
          });

          result.orphaned++;

          // Update round status to error
          await updateRound(roundId, {
            status: RoundStatus.ERROR
          });

          // Delete chunks
          await deleteChunkDirectory(chunkDir, roundId);
          result.deleted++;
        }

      } catch (error) {
        const errorMsg = `Failed to process ${roundId}: ${error instanceof Error ? error.message : String(error)}`;
        logger.error('Error processing chunk directory', { roundId, error });
        result.errors.push(errorMsg);
      }
    }

    logger.info('Cleanup completed', result);
    return result;

  } catch (error) {
    logger.error('Cleanup job failed', { error });
    throw error;
  }
}

/**
 * Delete a chunk directory and all its contents
 */
async function deleteChunkDirectory(chunkDir: string, roundId: string): Promise<void> {
  try {
    await fs.rm(chunkDir, { recursive: true, force: true });
    logger.info('Deleted chunk directory', { roundId, path: chunkDir });
  } catch (error) {
    logger.error('Failed to delete chunk directory', { roundId, error });
    throw error;
  }
}

/**
 * Run cleanup and return formatted results
 * Can be called from API route or CLI
 */
export async function runCleanup(): Promise<string> {
  const startTime = Date.now();
  const result = await cleanupOrphanedChunks();
  const duration = Date.now() - startTime;

  return `
Orphaned Chunks Cleanup Report
==============================
Scanned: ${result.scanned} directories
Orphaned: ${result.orphaned} directories
Deleted: ${result.deleted} directories
Duration: ${duration}ms
Errors: ${result.errors.length}
${result.errors.length > 0 ? '\nErrors:\n' + result.errors.join('\n') : ''}
  `.trim();
}
