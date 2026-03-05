import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

export const runtime = "nodejs";

const ALLOWED_KINDS = new Set(["avatars", "dataspaces"]);

function getUploadsDir(kind: string) {
  const root =
    process.env.UPLOADS_DIR ?? path.join(process.cwd(), "data", "uploads");
  return path.join(root, kind);
}

function getContentType(filename: string) {
  if (filename.endsWith(".png")) return "image/png";
  if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) return "image/jpeg";
  if (filename.endsWith(".webp")) return "image/webp";
  if (filename.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

export async function GET(
  _request: Request,
  { params }: { params: { kind: string; file: string } }
) {
  const kind = params.kind;
  if (!ALLOWED_KINDS.has(kind)) {
    return NextResponse.json({ error: "Invalid upload type" }, { status: 400 });
  }

  const safeName = path.basename(params.file);
  if (safeName !== params.file) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }

  const fullPath = path.join(getUploadsDir(kind), safeName);
  try {
    const data = await fs.readFile(fullPath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": getContentType(safeName),
        "Cache-Control": "public, max-age=86400"
      }
    });
  } catch (error) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
