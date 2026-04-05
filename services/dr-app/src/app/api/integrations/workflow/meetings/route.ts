import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkflowKey } from "@/app/api/integrations/workflow/utils";
import { generateRoomId } from "@/lib/utils";
import { sendMail } from "@/lib/mailer";
import { sendTelegramInvite } from "@/lib/telegramInvites";

export const dynamic = "force-dynamic";

const createWorkflowMeetingSchema = z.object({
  title: z.string().min(1),
  date: z.string().optional(),
  start_time: z.string().optional(),
  duration_minutes: z.number().int().positive().optional(),
  invite_emails: z.array(z.string().email()).optional(),
  language: z.enum(["EN", "IT"]).default("EN"),
  transcription_provider: z.enum(["DEEPGRAM", "DEEPGRAMLIVE", "VOSK", "WHISPERREMOTE", "AUTOREMOTE"]).default("DEEPGRAM"),
  timezone: z.string().max(100).optional().nullable(),
  dataspace_id: z.string().optional().nullable(),
  created_by_email: z.string().email().optional()
});

const listQuerySchema = z.object({
  dataspace_id: z.string().optional(),
  updated_since: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export async function GET(request: Request) {
  const authError = requireWorkflowKey(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const parsed = listQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updatedSince = parsed.data.updated_since
    ? new Date(parsed.data.updated_since)
    : null;
  if (parsed.data.updated_since && (!updatedSince || Number.isNaN(updatedSince.getTime()))) {
    return NextResponse.json({ error: "Invalid updated_since" }, { status: 400 });
  }

  const where: Record<string, unknown> = {};
  if (parsed.data.dataspace_id) {
    where.dataspaceId = parsed.data.dataspace_id;
  }
  if (updatedSince) {
    where.updatedAt = { gte: updatedSince };
  }

  const meetings = await prisma.meeting.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: parsed.data.limit,
    skip: parsed.data.offset,
    select: {
      id: true,
      title: true,
      roomId: true,
      dataspaceId: true,
      createdAt: true,
      scheduledStartAt: true,
      expiresAt: true,
      timezone: true,
      language: true,
      transcriptionProvider: true,
      transcriptionRoundId: true,
      transcript: {
        select: {
          provider: true,
          roundId: true,
          transcriptText: true
        }
      }
    }
  });

  return NextResponse.json({
    meetings: meetings.map((meeting: (typeof meetings)[number]) => ({
      id: meeting.id,
      title: meeting.title,
      roomId: meeting.roomId,
      dataspaceId: meeting.dataspaceId,
      createdAt: meeting.createdAt.toISOString(),
      scheduledStartAt: meeting.scheduledStartAt ? meeting.scheduledStartAt.toISOString() : null,
      expiresAt: meeting.expiresAt ? meeting.expiresAt.toISOString() : null,
      timezone: meeting.timezone ?? null,
      language: meeting.language,
      transcriptionProvider: meeting.transcriptionProvider,
      transcriptionRoundId: meeting.transcriptionRoundId,
      meetingTranscript: meeting.transcript
        ? {
            provider: meeting.transcript.provider,
            roundId: meeting.transcript.roundId,
            transcriptText: meeting.transcript.transcriptText
          }
        : null
    }))
  });
}

export async function POST(request: Request) {
  const authError = requireWorkflowKey(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const parsed = createWorkflowMeetingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const {
    title,
    date,
    start_time: startTime,
    duration_minutes: durationMinutes,
    invite_emails: inviteEmails,
    language,
    transcription_provider: transcriptionProvider,
    timezone,
    dataspace_id: dataspaceId,
    created_by_email: createdByEmail
  } = parsed.data;

  const providerLabel =
    transcriptionProvider === "VOSK"
      ? "Vosk"
      : transcriptionProvider === "AUTOREMOTE"
        ? "AUTOREMOTE"
      : transcriptionProvider === "WHISPERREMOTE"
        ? "WHISPERREMOTE"
      : transcriptionProvider === "DEEPGRAMLIVE"
        ? "DEEPGRAMLIVE"
        : "Deepgram";
  const roomId = `${generateRoomId()}-${language}-${providerLabel}`;
  let scheduledStartAt: Date | null = null;
  let expiresAt: Date | null = null;

  if (startTime && !date) {
    return NextResponse.json({ error: "Select a date for the start time." }, { status: 400 });
  }

  if (date && startTime) {
    const start = new Date(`${date}T${startTime}`);
    if (Number.isNaN(start.getTime())) {
      return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
    }
    if (start.getTime() < Date.now()) {
      return NextResponse.json({ error: "Start time must be in the future." }, { status: 400 });
    }
    scheduledStartAt = start;
  }

  if (durationMinutes) {
    if (scheduledStartAt) {
      expiresAt = new Date(scheduledStartAt.getTime() + durationMinutes * 60 * 1000);
    } else {
      expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
    }
  }

  const creator = createdByEmail
    ? await prisma.user.findUnique({ where: { email: createdByEmail } })
    : await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });

  if (!creator) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  if (dataspaceId) {
    const dataspace = await prisma.dataspace.findUnique({
      where: { id: dataspaceId },
      select: { id: true }
    });
    if (!dataspace) {
      return NextResponse.json({ error: "Dataspace not found" }, { status: 404 });
    }
  }

  const emailList = (inviteEmails ?? [])
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
  const uniqueEmails = Array.from(new Set(emailList)).filter(
    (email) => email !== creator.email.toLowerCase()
  );

  let invitedUsers: Array<{
    id: string;
    email: string;
    notifyTelegramMeetingInvites?: boolean;
    telegramHandle?: string | null;
    telegramChatId?: string | null;
  }> = [];
  if (uniqueEmails.length > 0) {
    invitedUsers = await prisma.user.findMany({
      where: { email: { in: uniqueEmails } },
      select: {
        id: true,
        email: true,
        notifyTelegramMeetingInvites: true,
        telegramHandle: true,
        telegramChatId: true
      }
    });

    if (invitedUsers.length !== uniqueEmails.length) {
      const found = new Set(invitedUsers.map((user) => user.email));
      const missing = uniqueEmails.filter((email) => !found.has(email));
      return NextResponse.json(
        { error: `Users not found: ${missing.join(", ")}` },
        { status: 404 }
      );
    }
  }

  const meeting = await prisma.meeting.create({
    data: {
      title,
      roomId,
      createdById: creator.id,
      scheduledStartAt,
      expiresAt,
      timezone: timezone || null,
      language,
      transcriptionProvider,
      dataspaceId: dataspaceId || null,
      members: {
        create: {
          userId: creator.id,
          role: "HOST"
        }
      }
    }
  });

  if (invitedUsers.length > 0) {
    for (const user of invitedUsers) {
      await prisma.meetingInvite.upsert({
        where: {
          meetingId_userId: {
            meetingId: meeting.id,
            userId: user.id
          }
        },
        update: { status: "PENDING" },
        create: {
          meetingId: meeting.id,
          userId: user.id,
          status: "PENDING"
        }
      });
    }

    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3015";
    const meetingLink = `${appBaseUrl}/meetings/${meeting.id}`;
    await Promise.all(
      invitedUsers.map((user) =>
        sendMail({
          to: user.email,
          subject: "You are invited to a meeting",
          html: `<p>You have been invited to the meeting <strong>${meeting.title}</strong>.</p>
            <p>Open the meeting page: <a href="${meetingLink}">${meetingLink}</a></p>`,
          text: `You have been invited to the meeting ${meeting.title}. Open: ${meetingLink}`
        })
      )
    );
    await Promise.all(
      invitedUsers.map((user) =>
        sendTelegramInvite(
          user,
          user.notifyTelegramMeetingInvites,
          "meeting",
          meeting.title,
          meetingLink
        )
      )
    );
  }

  return NextResponse.json({
    meeting_id: meeting.id,
    meeting_url: `${process.env.APP_BASE_URL || "http://localhost:3015"}/meetings/${meeting.id}`
  });
}
