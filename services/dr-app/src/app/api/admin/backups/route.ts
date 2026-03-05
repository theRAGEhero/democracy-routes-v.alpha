import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const BACKUP_DIR = process.env.BACKUP_DIR || "/backups";
const SCRIPT_PATH = process.env.BACKUP_SCRIPT_PATH || "/app/scripts/backup-runner.sh";

function isBackupFile(name: string) {
  return /^backup-\d{8}T\d{6}Z\.tar\.gz$/.test(name);
}

function toUrlSafe(name: string) {
  return encodeURIComponent(name);
}

export async function GET() {
  const session = await getSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const entries = await fs.readdir(BACKUP_DIR);
    const backups = [];
    for (const name of entries) {
      if (!isBackupFile(name)) continue;
      const fullPath = path.join(BACKUP_DIR, name);
      const stat = await fs.stat(fullPath);
      const checksumPath = `${fullPath}.sha256`;
      let checksumExists = false;
      try {
        await fs.access(checksumPath);
        checksumExists = true;
      } catch {
        checksumExists = false;
      }
      backups.push({
        name,
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
        checksumExists,
        downloadUrl: `/api/admin/backups/${toUrlSafe(name)}`,
        checksumUrl: checksumExists ? `/api/admin/backups/${toUrlSafe(`${name}.sha256`)}` : null
      });
    }
    backups.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return NextResponse.json({ backups });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to read backups directory." },
      { status: 500 }
    );
  }
}

export async function POST() {
  const session = await getSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await fs.access(SCRIPT_PATH);
  } catch {
    return NextResponse.json({ error: "Backup script not found." }, { status: 500 });
  }

  try {
    const { stdout, stderr } = await execFileAsync("/bin/bash", [SCRIPT_PATH], {
      env: { ...process.env, BACKUP_DIR },
      timeout: 1000 * 60 * 20
    });
    return NextResponse.json({
      ok: true,
      stdout: stdout.trim(),
      stderr: stderr.trim()
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Backup failed.",
        detail: error?.message ?? "Unknown error"
      },
      { status: 500 }
    );
  }
}
