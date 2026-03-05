/**
 * Deliberation Ontology creation utilities
 * Ported from Podfree-Editor: deepgram_transcribe_debates.py lines 125-225
 */

import { DeliberationOntology, DeepgramWord } from '@/types/deliberation';
import { groupWordsBySpeaker } from './grouper';
import { formatTimestamp, cleanFilename } from './formatter';

/**
 * Create Deliberation Ontology JSON structure from Deepgram response
 * Port of create_deliberation_ontology_json() from Python (lines 125-225)
 *
 * This function transforms the raw Deepgram API response into a structured
 * Deliberation Ontology format that includes:
 * - Process metadata (name, topic, duration)
 * - Participant information with statistics
 * - Individual contributions with timestamps
 * - Overall statistics
 *
 * @param responseDict - Raw Deepgram API response
 * @param audioFilename - Original audio filename
 * @returns DeliberationOntology structure
 */
export function createDeliberationOntology(
  responseDict: any,
  audioFilename: string,
  language?: string
): DeliberationOntology {
  // Extract basic data from Deepgram response
  const transcriptData = responseDict.results?.channels?.[0]?.alternatives?.[0];
  const words: DeepgramWord[] = transcriptData?.words ?? [];
  const metadata = responseDict.metadata ?? {};
  const resolvedLanguage = language ?? metadata.language ?? "en";

  // Group words into contributions by speaker
  const contributions = groupWordsBySpeaker(words);

  // Get unique speakers and sort them
  const speakers = Array.from(new Set(contributions.map(c => c.speaker))).sort();

  // Calculate total duration from last word end time
  const totalDuration = Math.max(...words.map(w => w.end ?? 0), 0);

  // Create debate identifier from filename
  const cleanName = cleanFilename(audioFilename);
  const debateId = `debate_${cleanName.toLowerCase()}`;

  // Create readable name by replacing underscores with spaces
  const readableName = cleanName.replace(/_/g, ' ');

  // Initialize the Deliberation Ontology structure
  const deliberationJson: DeliberationOntology = {
    "@context": {
      del: "https://w3id.org/deliberation/ontology#",
      xsd: "http://www.w3.org/2001/XMLSchema#"
    },
    deliberation_process: {
      "@type": "del:DeliberationProcess",
      identifier: debateId,
      name: readableName.split(' ').map(w =>
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ).join(' '),
      topic: {
        "@type": "del:Topic",
        identifier: `topic_${cleanName.toLowerCase()}`,
        text: readableName
      },
      source_file: audioFilename,
      duration: formatTimestamp(totalDuration),
      transcription_metadata: {
        model: metadata.model ?? "nova-2",
        language: resolvedLanguage,
        confidence: transcriptData?.confidence ?? 0,
        processed_at: new Date().toISOString(),
        word_count: words.length,
        speaker_count: speakers.length
      }
    },
    participants: [],
    contributions: [],
    statistics: {
      total_contributions: contributions.length,
      total_speakers: speakers.length,
      total_words: words.length,
      average_contribution_length: contributions.length > 0
        ? contributions.reduce((sum, c) => sum + c.words, 0) / contributions.length
        : 0,
      duration_seconds: totalDuration
    }
  };

  // Add participants with their statistics
  for (const speakerId of speakers) {
    const speakerContributions = contributions.filter(c => c.speaker === speakerId);
    const totalWords = speakerContributions.reduce((sum, c) => sum + c.words, 0);
    const speakingTime = speakerContributions.reduce(
      (sum, c) => sum + (c.end_time - c.start_time),
      0
    );

    deliberationJson.participants.push({
      "@type": "del:Participant",
      identifier: `speaker_${speakerId}`,
      name: `Speaker ${speakerId}`,
      role: {
        "@type": "del:Role",
        identifier: `debater_${speakerId}`,
        name: "Debate Participant"
      },
      statistics: {
        total_contributions: speakerContributions.length,
        total_words: totalWords,
        speaking_time_seconds: speakingTime,
        average_words_per_contribution: speakerContributions.length > 0
          ? totalWords / speakerContributions.length
          : 0
      }
    });
  }

  // Add contributions with detailed metadata
  for (let i = 0; i < contributions.length; i++) {
    const contrib = contributions[i];
    deliberationJson.contributions.push({
      "@type": "del:Contribution",
      identifier: `contribution_${(i + 1).toString().padStart(4, '0')}`,
      text: contrib.text,
      madeBy: `speaker_${contrib.speaker}`,
      timestamp: formatTimestamp(contrib.start_time),
      duration: formatTimestamp(contrib.end_time - contrib.start_time),
      start_time_seconds: contrib.start_time,
      end_time_seconds: contrib.end_time,
      word_count: contrib.words,
      sequence_number: i + 1
    });
  }

  return deliberationJson;
}
