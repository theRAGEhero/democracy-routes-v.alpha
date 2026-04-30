import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { requireWorkflowKey } from "@/app/api/integrations/workflow/utils";

export const runtime = "nodejs";

function getAudioDir() {
  const uploadsRoot =
    process.env.UPLOADS_DIR ?? path.join(process.cwd(), "data", "uploads");
  return process.env.MEDITATION_AUDIO_DIR ?? path.join(uploadsRoot, "meditation-audio");
}

function isAllowedFile(name: string) {
  return /\.(mp3|wav|m4a|webm)$/i.test(name);
}

export async function GET(request: Request) {
  const authError = requireWorkflowKey(request);
  if (authError) return authError;

  const dir = getAudioDir();
  await fs.mkdir(dir, { recursive: true });
  const entries = await fs.readdir(dir);
  const files = entries.filter(isAllowedFile).map((filename) => ({
    name: filename,
    url: `/api/meditation/audio/${encodeURIComponent(filename)}`
  }));

  return NextResponse.json({ files });
}
