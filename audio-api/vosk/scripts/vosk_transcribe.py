#!/usr/bin/env python3
import argparse
import json
import subprocess
import sys
from pathlib import Path

from vosk import Model, KaldiRecognizer


def run_ffmpeg(input_path: Path):
    cmd = [
        "ffmpeg",
        "-nostdin",
        "-loglevel",
        "quiet",
        "-i",
        str(input_path),
        "-ar",
        "16000",
        "-ac",
        "1",
        "-f",
        "s16le",
        "-",
    ]
    return subprocess.Popen(cmd, stdout=subprocess.PIPE)


def transcribe(model_path: Path, input_path: Path):
    model = Model(str(model_path))
    rec = KaldiRecognizer(model, 16000.0)
    rec.SetWords(True)

    proc = run_ffmpeg(input_path)
    results = []

    while True:
        data = proc.stdout.read(4000)
        if len(data) == 0:
            break
        if rec.AcceptWaveform(data):
            results.append(json.loads(rec.Result()))

    results.append(json.loads(rec.FinalResult()))
    proc.wait()

    words = []
    full_text_parts = []
    for part in results:
        if part.get("text"):
            full_text_parts.append(part["text"])
        if "result" in part:
            words.extend(part["result"])

    duration = 0.0
    if words:
        duration = max(w.get("end", 0.0) for w in words)

    return {
        "text": " ".join(full_text_parts).strip(),
        "result": words,
        "duration": duration,
    }


def main():
    parser = argparse.ArgumentParser(description="Run VOSK transcription and emit JSON.")
    parser.add_argument("--model", required=True, help="Path to VOSK model directory")
    parser.add_argument("--input", required=True, help="Input media file")
    parser.add_argument("--output", required=True, help="Output JSON path")
    args = parser.parse_args()

    model_path = Path(args.model)
    input_path = Path(args.input)
    output_path = Path(args.output)

    if not model_path.exists():
        print(f"Model path not found: {model_path}", file=sys.stderr)
        sys.exit(1)
    if not input_path.exists():
        print(f"Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    payload = transcribe(model_path, input_path)
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
