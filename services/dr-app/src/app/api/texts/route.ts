import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { notifyDataspaceSubscribers } from "@/lib/dataspaceNotifications";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true }
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  let dataspaceId: string | null = null;
  let content: string | null = null;
  let isMultipart = false;

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    isMultipart = true;
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const rawContent = formData.get("content");
    const rawDataspaceId = formData.get("dataspaceId");
    if (typeof rawDataspaceId === "string") {
      dataspaceId = rawDataspaceId || null;
    }
    if (typeof rawContent === "string") {
      content = rawContent;
    }
    if (file) {
      const name = file.name.toLowerCase();
      if (!name.endsWith(".txt")) {
        return NextResponse.json({ error: "Only .txt files are supported" }, { status: 400 });
      }
      if (file.size > 2 * 1024 * 1024) {
        return NextResponse.json({ error: "File is too large (max 2MB)" }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const text = buffer.toString("utf-8");
      content = `${content ?? ""}${content ? "\n\n" : ""}${text}`.trim();
    }
  } else {
    const body = await request.json().catch(() => null);
    dataspaceId = body?.dataspaceId ?? null;
    if (typeof body?.content === "string") {
      content = body.content;
    }
  }

  if (dataspaceId) {
    const member = await prisma.dataspaceMember.findUnique({
      where: {
        dataspaceId_userId: {
          dataspaceId,
          userId: session.user.id
        }
      }
    });
    if (!member) {
      return NextResponse.json({ error: "Invalid dataspace selection" }, { status: 403 });
    }
  }

  const text = await prisma.text.create({
    data: {
      createdById: user.id,
      dataspaceId,
      content: content ?? ""
    },
    select: { id: true }
  });

  if (dataspaceId) {
    try {
      const title = (content ?? "").trim().split("\n")[0]?.slice(0, 80) || "Text note";
      const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
      await notifyDataspaceSubscribers({
        dataspaceId,
        title,
        link: `${appBaseUrl}/texts/${text.id}`,
        type: "NOTES"
      });
    } catch {
      // best-effort
    }
  }

  return NextResponse.json({ id: text.id });
}
