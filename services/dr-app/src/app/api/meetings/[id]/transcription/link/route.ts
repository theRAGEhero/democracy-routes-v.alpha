import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { linkTranscriptionSchema } from "@/lib/validators";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = linkTranscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
    include: {
      members: {
        where: { userId: session.user.id }
      }
    }
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isHost = meeting.members.some(
    (member: (typeof meeting.members)[number]) => member.role === "HOST"
  );
  if (!isAdmin && !isHost) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.meeting.update({
    where: { id: meeting.id },
    data: { transcriptionRoundId: parsed.data.roundId }
  });

  return NextResponse.json({ message: "Transcription linked" });
}
