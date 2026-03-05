// Deliberation Ontology type definitions
// Matches the JSON structure from Podfree-Editor

export interface DeliberationOntology {
  "@context": {
    del: string;
    xsd: string;
  };
  deliberation_process: DeliberationProcess;
  participants: Participant[];
  contributions: Contribution[];
  statistics: Statistics;
}

export interface DeliberationProcess {
  "@type": "del:DeliberationProcess";
  identifier: string;
  name: string;
  topic: Topic;
  source_file: string;
  duration: string; // ISO 8601 format: PT00H00M00.000S
  transcription_metadata: TranscriptionMetadata;
}

export interface Topic {
  "@type": "del:Topic";
  identifier: string;
  text: string;
}

export interface TranscriptionMetadata {
  model: string;
  language: string;
  confidence: number;
  processed_at: string; // ISO 8601 timestamp
  word_count: number;
  speaker_count: number;
}

export interface Participant {
  "@type": "del:Participant";
  identifier: string;
  name: string;
  role: Role;
  statistics: ParticipantStatistics;
}

export interface Role {
  "@type": "del:Role";
  identifier: string;
  name: string;
}

export interface ParticipantStatistics {
  total_contributions: number;
  total_words: number;
  speaking_time_seconds: number;
  average_words_per_contribution: number;
}

export interface Contribution {
  "@type": "del:Contribution";
  identifier: string;
  text: string;
  madeBy: string; // Reference to speaker_X
  timestamp: string; // ISO 8601 format
  duration: string; // ISO 8601 format
  start_time_seconds: number;
  end_time_seconds: number;
  word_count: number;
  sequence_number: number;
}

export interface Statistics {
  total_contributions: number;
  total_speakers: number;
  total_words: number;
  average_contribution_length: number;
  duration_seconds: number;
}

// Intermediate types for processing Deepgram responses

export interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: number;
}

export interface GroupedContribution {
  speaker: number;
  text: string;
  start_time: number;
  end_time: number;
  words: number;
}
