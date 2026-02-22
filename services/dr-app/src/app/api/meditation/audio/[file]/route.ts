import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

export const runtime = "nodejs";

function getAudioDir() {
  return (
    process.env.MEDITATION_AUDIO_DIR ??
    path.join(process.cwd(), "data", "meditation-audio")
  );
}

function getContentType(filename: string) {
  if (filename.endsWith(".mp3")) return "audio/mpeg";
  if (filename.endsWith(".wav")) return "audio/wav";
  if (filename.endsWith(".m4a")) return "audio/mp4";
  if (filename.endsWith(".webm")) return "audio/webm";
  return "application/octet-stream";
}

export async function GET(
  _request: Request,
  { params }: { params: { file: string } }
) {
  const safeName = path.basename(params.file);
  if (safeName !== params.file) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }

  const fullPath = path.join(getAudioDir(), safeName);
  try {
    const data = await fs.readFile(fullPath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": getContentType(safeName)
      }
    });
  } catch (error) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
