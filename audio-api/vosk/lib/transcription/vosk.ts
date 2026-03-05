import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { getLogger } from '@/lib/logging/logger';

const logger = getLogger('transcription.vosk');

interface VoskWord {
  word: string;
  start: number;
  end: number;
  conf: number;
}

interface VoskResult {
  text: string;
  result: VoskWord[];
  duration?: number;
}

export interface TranscriptionResponse {
  metadata: {
    model: string;
    language: string;
    duration: number;
    created: string;
  };
  results: {
    channels: Array<{
      alternatives: Array<{
        transcript: string;
        confidence: number;
        words: Array<{
          word: string;
          start: number;
          end: number;
          confidence: number;
          speaker: number;
        }>;
      }>;
    }>;
  };
}

function resolveVoskPython(): string {
  return process.env.VOSK_PYTHON || path.join(process.cwd(), '.venv', 'bin', 'python');
}

function resolveVoskModelPath(language: string): string {
  const lang = language.toLowerCase();
  if (lang.startsWith('it')) {
    return process.env.VOSK_MODEL_IT || path.join(process.cwd(), 'models', 'vosk-model-small-it-0.22');
  }
  return process.env.VOSK_MODEL_EN || path.join(process.cwd(), 'models', 'vosk-model-en-us-0.22-lgraph');
}

async function runVoskScript(inputPath: string, language: string): Promise<VoskResult> {
  const python = resolveVoskPython();
  const modelPath = resolveVoskModelPath(language);
  const scriptPath = path.join(process.cwd(), 'scripts', 'vosk_transcribe.py');
  await fs.access(python);
  await fs.access(modelPath);
  await fs.access(scriptPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vosk-'));
  const outputPath = path.join(tempDir, 'result.json');

  logger.info('Starting VOSK transcription', { inputPath, modelPath, python });

  await new Promise<void>((resolve, reject) => {
    const child = spawn(python, [
      scriptPath,
      '--model',
      modelPath,
      '--input',
      inputPath,
      '--output',
      outputPath
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr.trim() || `VOSK process exited with code ${code}`));
      }
    });
  });

  const content = await fs.readFile(outputPath, 'utf-8');
  const payload = JSON.parse(content) as VoskResult;

  await fs.rm(tempDir, { recursive: true, force: true });

  return payload;
}

function averageConfidence(words: VoskWord[]): number {
  if (!words.length) return 0;
  const total = words.reduce((sum, word) => sum + (word.conf ?? 0), 0);
  return total / words.length;
}

export async function transcribeWithVosk(inputPath: string, language: string = 'en'): Promise<TranscriptionResponse> {
  const result = await runVoskScript(inputPath, language);
  const words = result.result || [];
  const duration = typeof result.duration === 'number'
    ? result.duration
    : (words.length ? Math.max(...words.map(word => word.end || 0)) : 0);

  const wordEntries = words.map(word => ({
    word: word.word,
    start: word.start,
    end: word.end,
    confidence: word.conf,
    speaker: 1
  }));

  const response: TranscriptionResponse = {
    metadata: {
      model: 'vosk',
      language,
      duration,
      created: new Date().toISOString()
    },
    results: {
      channels: [
        {
          alternatives: [
            {
              transcript: result.text || '',
              confidence: averageConfidence(words),
              words: wordEntries
            }
          ]
        }
      ]
    }
  };

  return response;
}
