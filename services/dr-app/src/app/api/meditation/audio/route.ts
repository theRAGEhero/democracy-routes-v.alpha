import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

function getAudioDir() {
  return (
    process.env.MEDITATION_AUDIO_DIR ??
    path.join(process.cwd(), "data", "meditation-audio")
  );
}

function isAllowedFile(name: string) {
  return /\.(mp3|wav|m4a|webm)$/i.test(name);
}

function sanitizeFilename(name: string) {
  const base = name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return base.length ? base : "audio";
}

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dir = getAudioDir();
  await fs.mkdir(dir, { recursive: true });
  const entries = await fs.readdir(dir);
  const files = entries.filter(isAllowedFile).map((filename) => ({
    name: filename,
    url: `/api/meditation/audio/${encodeURIComponent(filename)}`
  }));

  return NextResponse.json({ files });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  const safeName = sanitizeFilename(file.name);
  if (!isAllowedFile(safeName)) {
    return NextResponse.json({ error: "Unsupported audio type" }, { status: 400 });
  }

  const dir = getAudioDir();
  await fs.mkdir(dir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${timestamp}-${safeName}`;
  const fullPath = path.join(dir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(fullPath, buffer);

  return NextResponse.json({
    name: filename,
    url: `/api/meditation/audio/${encodeURIComponent(filename)}`
  });
}
