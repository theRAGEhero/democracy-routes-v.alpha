/**
 * Speaker grouping utilities
 * Ported from Podfree-Editor: deepgram_transcribe_debates.py lines 71-123
 */

import { DeepgramWord, GroupedContribution } from '@/types/deliberation';

/**
 * Group consecutive words by the same speaker into contributions
 * Port of group_words_by_speaker() from Python (lines 71-123)
 *
 * This function takes an array of words from Deepgram (each with a speaker ID)
 * and groups consecutive words from the same speaker into single "contributions".
 *
 * @param words - Array of words from Deepgram response with speaker IDs
 * @returns Array of contributions grouped by speaker
 */
export function groupWordsBySpeaker(words: DeepgramWord[]): GroupedContribution[] {
  const contributions: GroupedContribution[] = [];

  if (!words || words.length === 0) {
    return contributions;
  }

  let currentSpeaker: number | null = null;
  let currentWords: string[] = [];
  let currentStart: number | null = null;
  let currentEnd: number | null = null;

  for (const word of words) {
    const wordSpeaker = word.speaker ?? 0;
    const wordText = word.word ?? '';
    const wordStart = word.start ?? 0;
    const wordEnd = word.end ?? 0;

    if (currentSpeaker !== wordSpeaker) {
      // Save previous contribution if exists
      if (currentWords.length > 0 && currentSpeaker !== null && currentStart !== null && currentEnd !== null) {
        const contributionText = currentWords.join(' ').trim();
        if (contributionText) {
          contributions.push({
            speaker: currentSpeaker,
            text: contributionText,
            start_time: currentStart,
            end_time: currentEnd,
            words: currentWords.length
          });
        }
      }

      // Start new contribution
      currentSpeaker = wordSpeaker;
      currentWords = [wordText];
      currentStart = wordStart;
      currentEnd = wordEnd;
    } else {
      // Continue current contribution
      currentWords.push(wordText);
      currentEnd = wordEnd;
    }
  }

  // Add the last contribution
  if (currentWords.length > 0 && currentSpeaker !== null && currentStart !== null && currentEnd !== null) {
    const contributionText = currentWords.join(' ').trim();
    if (contributionText) {
      contributions.push({
        speaker: currentSpeaker,
        text: contributionText,
        start_time: currentStart,
        end_time: currentEnd,
        words: currentWords.length
      });
    }
  }

  return contributions;
}
