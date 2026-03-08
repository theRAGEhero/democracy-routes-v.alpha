import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type StoredMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
};

function sanitizeMessages(input: unknown): StoredMessage[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item) => item && typeof item === "object")
    .map((item, index) => {
      const role = String((item as any).role || "");
      const text = String((item as any).text || "").trim();
      if (!text) return null;
      if (role !== "user" && role !== "assistant" && role !== "system") return null;
      return {
        id: String((item as any).id || `${role}-${index}`),
        role,
        text
      } as StoredMessage;
    })
    .filter(Boolean) as StoredMessage[];
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const templateId = String(searchParams.get("templateId") || "").trim();
  if (!templateId) {
    return NextResponse.json({ messages: [] });
  }

  const conversation = await prisma.templateAiConversation.findUnique({
    where: {
      templateId_userId: {
        templateId,
        userId: session.user.id
      }
    },
    select: { messagesJson: true }
  });

  if (!conversation) {
    return NextResponse.json({ messages: [] });
  }

  let parsed: StoredMessage[] = [];
  try {
    parsed = sanitizeMessages(JSON.parse(conversation.messagesJson));
  } catch {
    parsed = [];
  }

  return NextResponse.json({ messages: parsed });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const templateId = String(body?.templateId || "").trim();
  const messages = sanitizeMessages(body?.messages);
  if (!templateId) {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }

  const template = await prisma.planTemplate.findFirst({
    where: {
      id: templateId,
      OR: [{ createdById: session.user.id }, { isPublic: true }]
    },
    select: { id: true }
  });
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  await prisma.templateAiConversation.upsert({
    where: {
      templateId_userId: {
        templateId,
        userId: session.user.id
      }
    },
    update: { messagesJson: JSON.stringify(messages) },
    create: {
      templateId,
      userId: session.user.id,
      messagesJson: JSON.stringify(messages)
    }
  });

  return NextResponse.json({ ok: true });
}
