import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import fs from "fs/promises";
import path from "path";
import { createReadStream } from "fs";
import { Readable } from "stream";

const BACKUP_DIR = process.env.BACKUP_DIR || "/backups";

function isAllowedName(name: string) {
  return /^backup-\d{8}T\d{6}Z\.tar\.gz(\.sha256)?$/.test(name);
}

export async function GET(
  _request: Request,
  { params }: { params: { name: string } }
) {
  const session = await getSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const name = params.name;
  if (!isAllowedName(name)) {
    return NextResponse.json({ error: "Invalid file name." }, { status: 400 });
  }

  const filePath = path.join(BACKUP_DIR, name);
  try {
    await fs.access(filePath);
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const stream = createReadStream(filePath);
  const webStream = Readable.toWeb(stream) as ReadableStream;
  const isChecksum = name.endsWith(".sha256");
  return new NextResponse(webStream, {
    headers: {
      "Content-Type": isChecksum ? "text/plain" : "application/gzip",
      "Content-Disposition": `attachment; filename=\"${name}\"`
    }
  });
}
