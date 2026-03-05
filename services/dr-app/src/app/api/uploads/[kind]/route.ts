import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const ALLOWED_KINDS = new Set(["avatars", "dataspaces"]);
const MAX_BYTES = 5 * 1024 * 1024;

function getUploadsDir(kind: string) {
  const root =
    process.env.UPLOADS_DIR ?? path.join(process.cwd(), "data", "uploads");
  return path.join(root, kind);
}

function sanitizeFilename(name: string) {
  const base = name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return base.length ? base : "image";
}

function isAllowedImage(name: string) {
  return /\.(png|jpg|jpeg|webp|gif)$/i.test(name);
}

export async function POST(
  request: Request,
  { params }: { params: { kind: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const kind = params.kind;
  if (!ALLOWED_KINDS.has(kind)) {
    return NextResponse.json({ error: "Invalid upload type" }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large (max 5MB)" }, { status: 400 });
  }

  const safeName = sanitizeFilename(file.name || "image");
  if (!isAllowedImage(safeName)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }

  const dir = getUploadsDir(kind);
  await fs.mkdir(dir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${timestamp}-${safeName}`;
  const fullPath = path.join(dir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(fullPath, buffer);

  return NextResponse.json({
    name: filename,
    url: `/api/uploads/${encodeURIComponent(kind)}/${encodeURIComponent(filename)}`
  });
}
