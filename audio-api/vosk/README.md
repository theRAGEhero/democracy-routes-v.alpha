# VOSK-modular

Audio recording and transcription platform using local VOSK and Next.js.

## Features

- **Audio Recording**: Browser-based audio recording with real-time duration tracking
- **Transcription**: Automatic transcription using local VOSK model
- **Deliberation Ontology**: Structured output with speakers, contributions, and statistics
- **Round Management**: Create, track, and manage deliberation rounds
- **File Storage**: Local storage for audio files and transcription JSON

## Prerequisites

- Node.js 18+ and npm
- Local VOSK models (English + Italian)
- Python 3 with virtual environment support
- ffmpeg

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env.local` from template:
   ```bash
   cp .env.example .env.local
   ```

4. Create a local venv and install VOSK:
   ```bash
   python3 -m venv .venv
   ./.venv/bin/pip install vosk
   ```

5. Place the VOSK models in:
   - `./models/vosk-model-en-us-0.22-lgraph`
   - `./models/vosk-model-small-it-0.22`
   - Update `VOSK_MODEL_EN` / `VOSK_MODEL_IT` in `.env.local` if you use different paths.

6. Run the development server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3009](http://localhost:3009) in your browser

## Environment Variables

See `.env.example` for required configuration:

- `VOSK_MODEL_EN`: Path to the local VOSK English model (required)
- `VOSK_MODEL_IT`: Path to the local VOSK Italian model (required)
- `VOSK_PYTHON`: Python interpreter for the local venv (required)
- `NEXT_PUBLIC_MAX_FILE_SIZE`: Maximum upload file size in bytes (default: 100MB)
- `NEXT_PUBLIC_ALLOWED_MEDIA_TYPES`: Comma-separated list of allowed media types
- `LOG_LEVEL`: Logging level (debug, info, warn, error)
- `LOG_DIR`: Directory for log files
- `LOG_TO_FILE`: Enable file logging (true/false)

## Usage

1. **Create a Round**: Navigate to "New Round" and enter round details
2. **Record Audio**: Use the built-in recorder or upload an audio/video file
3. **Transcription**: Audio is automatically transcribed using VOSK
4. **View Results**: See transcription with timestamps and statistics

## Project Structure

```
VOSK-modular/
├── app/                  # Next.js App Router
│   ├── api/             # API routes (transcription, rounds)
│   ├── rounds/          # Round management pages
│   └── page.tsx         # Home page
├── components/          # React components
│   ├── recording/       # Audio recording components
│   └── ui/             # shadcn/ui components
├── lib/                # Utilities
│   ├── deliberation/   # Deliberation ontology processing
│   ├── storage/        # File and data storage
│   └── logging/        # Logging utilities
├── types/              # TypeScript definitions
├── data/               # Local data storage (ignored by git)
└── public/             # Static assets
```

## Security

⚠️ **IMPORTANT**: Never commit `.env.local` or any file containing credentials!

The `.gitignore` file is configured to exclude:
- `.env.local` and all `.env*.local` files
- `/data` directory (contains audio files and transcriptions)
- `/logs` directory
- API keys and credentials

## API Endpoints

- `POST /api/transcribe` - Upload audio and queue transcription
- `GET /api/rounds` - List all rounds
- `POST /api/rounds` - Create new round
- `GET /api/rounds/[roundId]` - Get round details
- `GET /api/rounds/[roundId]/transcription` - Get round transcription
- `PATCH /api/rounds/[roundId]` - Update round

## Technologies

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Transcription**: VOSK (local)
- **Audio**: Browser MediaRecorder API

## License

[Your License Here]
