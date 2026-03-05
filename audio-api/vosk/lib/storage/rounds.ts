/**
 * Rounds storage utilities
 * Manages rounds metadata in data/rounds.json
 */

import fs from 'fs/promises';
import path from 'path';
import { Round } from '@/types/round';
import { deleteRoundFiles } from './files';
import { getLogger } from '@/lib/logging/logger';

const logger = getLogger('storage.rounds');

const DATA_DIR = path.join(process.cwd(), 'data');
const ROUNDS_FILE = path.join(DATA_DIR, 'rounds.json');

/**
 * Ensure rounds.json file exists
 */
async function ensureRoundsFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(ROUNDS_FILE);
  } catch {
    // File doesn't exist, create it with empty array
    await fs.writeFile(ROUNDS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

/**
 * Get all rounds
 */
export async function getRounds(): Promise<Round[]> {
  logger.debug('Fetching all rounds');

  try {
    await ensureRoundsFile();
    const content = await fs.readFile(ROUNDS_FILE, 'utf-8');
    const rounds = JSON.parse(content);

    logger.info('Rounds fetched successfully', { count: rounds.length });
    return rounds;
  } catch (error) {
    logger.error('Failed to fetch rounds', { error });
    throw error;
  }
}

/**
 * Get a single round by ID
 * @param roundId - Unique round identifier
 */
export async function getRound(roundId: string): Promise<Round | null> {
  logger.debug('Fetching round', { roundId });

  try {
    const rounds = await getRounds();
    const round = rounds.find(r => r.id === roundId) ?? null;

    if (round) {
      logger.info('Round fetched successfully', { roundId, status: round.status });
    } else {
      logger.warn('Round not found', { roundId });
    }

    return round;
  } catch (error) {
    logger.error('Failed to fetch round', { error, roundId });
    throw error;
  }
}

/**
 * Create a new round
 * @param round - Round data
 */
export async function createRound(round: Round): Promise<Round> {
  logger.info('Creating new round', { roundId: round.id, name: round.name, status: round.status });

  try {
    await ensureRoundsFile();
    const rounds = await getRounds();
    rounds.unshift(round); // Add to beginning of array
    await fs.writeFile(ROUNDS_FILE, JSON.stringify(rounds, null, 2), 'utf-8');

    logger.info('Round created successfully', { roundId: round.id });
    return round;
  } catch (error) {
    logger.error('Failed to create round', { error, roundId: round.id });
    throw error;
  }
}

/**
 * Update an existing round
 * @param roundId - Unique round identifier
 * @param updates - Partial round data to update
 */
export async function updateRound(
  roundId: string,
  updates: Partial<Round>
): Promise<Round | null> {
  logger.info('Updating round', { roundId, updates: Object.keys(updates) });

  try {
    const rounds = await getRounds();
    const index = rounds.findIndex(r => r.id === roundId);

    if (index === -1) {
      logger.warn('Round not found for update', { roundId });
      return null;
    }

    rounds[index] = { ...rounds[index], ...updates };
    await fs.writeFile(ROUNDS_FILE, JSON.stringify(rounds, null, 2), 'utf-8');

    logger.info('Round updated successfully', { roundId, status: rounds[index].status });
    return rounds[index];
  } catch (error) {
    logger.error('Failed to update round', { error, roundId });
    throw error;
  }
}

/**
 * Delete a round and all associated files
 * @param roundId - Unique round identifier
 */
export async function deleteRound(roundId: string): Promise<boolean> {
  logger.info('Deleting round', { roundId });

  try {
    const rounds = await getRounds();
    const index = rounds.findIndex(r => r.id === roundId);

    if (index === -1) {
      logger.warn('Round not found for deletion', { roundId });
      return false;
    }

    // Remove from array
    rounds.splice(index, 1);
    await fs.writeFile(ROUNDS_FILE, JSON.stringify(rounds, null, 2), 'utf-8');

    // Delete associated files
    await deleteRoundFiles(roundId);

    logger.info('Round deleted successfully', { roundId });
    return true;
  } catch (error) {
    logger.error('Failed to delete round', { error, roundId });
    throw error;
  }
}
