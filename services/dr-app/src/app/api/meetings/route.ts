import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMeetingSchema } from "@/lib/validators";
import { getSession } from "@/lib/session";
import { generateRoomId } from "@/lib/utils";
import { sendMail } from "@/lib/mailer";
import { notifyDataspaceSubscribers } from "@/lib/dataspaceNotifications";
import { checkRateLimit, getRequestIp } from "@/lib/rateLimit";
import { getRequestId, logError } from "@/lib/logger";
import { getRoomProviderSuffix, isLiveTranscriptionProvider } from "@/lib/transcriptionProviders";
import crypto from "crypto";

const GOVERNANCE_TITLE_ADJECTIVES = [
  "Civic",
  "Deliberative",
  "Commons",
  "Public",
  "Democratic",
  "Inclusive",
  "Participatory",
  "Community",
  "Restorative",
  "Mediation",
  "Consensus",
  "Bridge",
  "Peace",
  "Cooperative",
  "Mutual",
  "Solidarity",
  "Dialogue"
];

const GOVERNANCE_TITLE_NOUNS = [
  "Forum",
  "Roundtable",
  "Assembly",
  "Council",
  "Dialogue",
  "Mediation",
  "Commons",
  "Policy Lab",
  "Civic Lab",
  "Listening Circle",
  "Peace Table",
  "Consensus Table",
  "Conflict Lab",
  "Governance Lab",
  "Civic Session",
  "Deliberation",
  "Public Square"
];

function pickRandom(list: string[]) {
  const idx = crypto.randomInt(0, list.length);
  return list[idx] ?? list[0] ?? "Civic";
}

function generateToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getRequestIp(request);
  const rate = checkRateLimit({
    key: `meeting-create:${session.user.id}:${ip}`,
    limit: 10,
    windowMs: 10 * 60 * 1000
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createMeetingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const {
    title: rawTitle,
    description,
    startAt: startAtRaw,
    date,
    startTime,
    durationMinutes,
    inviteEmails,
    language,
    transcriptionProvider,
    timezone,
    dataspaceId,
    isPublic,
    requiresApproval,
    capacity,
    aiAgentIds
  } = parsed.data;
  const fallbackTitle = `${pickRandom(GOVERNANCE_TITLE_ADJECTIVES)} ${pickRandom(GOVERNANCE_TITLE_NOUNS)}`;
  const title = String(rawTitle || "").trim() || fallbackTitle;
  const effectiveAiAgentIds = isLiveTranscriptionProvider(transcriptionProvider) ? aiAgentIds ?? [] : [];
  const providerLabel = getRoomProviderSuffix(transcriptionProvider);
  const roomId = `${generateRoomId()}-${language}-${providerLabel}`;
  let scheduledStartAt: Date | null = null;
  let expiresAt: Date | null = null;

  if (startTime && !date && !startAtRaw) {
    return NextResponse.json({ error: "Select a date for the start/end time." }, { status: 400 });
  }

  if (startAtRaw) {
    const start = new Date(startAtRaw);
    if (Number.isNaN(start.getTime())) {
      return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
    }
    if (start.getTime() < Date.now()) {
      return NextResponse.json({ error: "Start time must be in the future." }, { status: 400 });
    }
    scheduledStartAt = start;
  } else if (date && startTime) {
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

  if (dataspaceId) {
    const membership = await prisma.dataspaceMember.findUnique({
      where: {
        dataspaceId_userId: {
          dataspaceId,
          userId: session.user.id
        }
      }
    });
    if (!membership) {
      return NextResponse.json({ error: "Invalid dataspace selection" }, { status: 403 });
    }
  }
  if (isPublic && !dataspaceId) {
    return NextResponse.json({ error: "Public meetings require a dataspace." }, { status: 400 });
  }

  const emailList = (inviteEmails ?? [])
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
  const uniqueEmails = Array.from(new Set(emailList)).filter(
    (email) => email !== session.user.email.toLowerCase()
  );

  let invitedUsers: Array<{
    id: string;
    email: string;
    isGuest: boolean;
    notifyEmailMeetingInvites?: boolean;
  }> = [];
  let missingUsers: string[] = [];

  if (uniqueEmails.length > 0) {
    invitedUsers = await prisma.user.findMany({
      where: { email: { in: uniqueEmails } },
      select: { id: true, email: true, isGuest: true, notifyEmailMeetingInvites: true }
    });

    if (invitedUsers.length !== uniqueEmails.length) {
      const found = new Set(invitedUsers.map((user) => user.email));
      missingUsers = uniqueEmails.filter((email) => !found.has(email));
    }
  }

  const meeting = await prisma.meeting.create({
    data: {
      title,
      description: description || null,
      roomId,
      createdById: session.user.id,
      scheduledStartAt,
      expiresAt,
      timezone: timezone || null,
      language,
      transcriptionProvider,
      dataspaceId: dataspaceId || null,
      isPublic: Boolean(isPublic),
      requiresApproval: Boolean(requiresApproval),
      capacity: capacity ?? null,
      members: {
        create: {
          userId: session.user.id,
          role: "HOST"
        }
      }
    }
  });

  if (effectiveAiAgentIds.length > 0) {
    const enabledAgents = await prisma.aiAgent.findMany({
      where: {
        id: { in: effectiveAiAgentIds },
        enabled: true
      },
      select: { id: true, defaultIntervalSeconds: true }
    });
    if (enabledAgents.length > 0) {
      await prisma.meetingAiAgent.createMany({
        data: enabledAgents.map((agent) => ({
          meetingId: meeting.id,
          agentId: agent.id,
          intervalSeconds: Math.max(15, agent.defaultIntervalSeconds || 60)
        }))
      });
    }
  }

  const registeredInvites = invitedUsers.filter((user) => !user.isGuest);
  const guestEmails = Array.from(
    new Set([
      ...missingUsers,
      ...invitedUsers.filter((user) => user.isGuest).map((user) => user.email)
    ])
  );

  if (registeredInvites.length > 0) {
    for (const user of registeredInvites) {
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

    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    await Promise.all(
      registeredInvites
        .filter((user) => user.notifyEmailMeetingInvites !== false)
        .map((user) =>
          sendMail({
            to: user.email,
            subject: "You are invited to a meeting",
            html: `<p>You have been invited to the meeting <strong>${meeting.title}</strong>.</p>
              <p>Open the meeting page: <a href="${appBaseUrl}/meetings/${meeting.id}">${appBaseUrl}/meetings/${meeting.id}</a></p>`,
            text: `You have been invited to the meeting ${meeting.title}. Open: ${appBaseUrl}/meetings/${meeting.id}`
          })
        )
    );
  }

  if (guestEmails.length > 0) {
    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    const registerLink = `${appBaseUrl}/register`;
    const guestFailures: string[] = [];

    await Promise.all(
      guestEmails.map(async (email) => {
        const token = generateToken();
        const invite = await prisma.meetingGuestInvite.upsert({
          where: {
            meetingId_email: {
              meetingId: meeting.id,
              email
            }
          },
          update: {
            token,
            expiresAt
          },
          create: {
            meetingId: meeting.id,
            createdById: session.user.id,
            email,
            token,
            expiresAt
          }
        });

        const guestLink = `${appBaseUrl}/guest/meetings/${invite.token}`;
        const emailResult = await sendMail({
          to: email,
          subject: "You are invited to a meeting",
          html: `<p>You have been invited to the meeting <strong>${meeting.title}</strong>.</p>
            <p>Join without registration: <a href="${guestLink}">${guestLink}</a></p>
            <p>Prefer to register? Create an account: <a href="${registerLink}">${registerLink}</a></p>`,
          text: `You have been invited to the meeting ${meeting.title}. Join without registration: ${guestLink}. Register: ${registerLink}`
        });

        if (!emailResult.ok) {
          guestFailures.push(email);
        }
      })
    );

    missingUsers = guestFailures;
  } else {
    missingUsers = [];
  }

  if (meeting.dataspaceId) {
    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    try {
      await notifyDataspaceSubscribers({
        dataspaceId: meeting.dataspaceId,
        title: meeting.title,
        link: `${appBaseUrl}/meetings/${meeting.id}`,
        type: "MEETING"
      });
    } catch (error) {
      logError("telegram_notify_failed", error, {
        requestId,
        scope: "meeting",
        dataspaceId: meeting.dataspaceId,
        meetingId: meeting.id
      });
    }
  }

  return NextResponse.json({ id: meeting.id, missingUsers });
}

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meetings = await prisma.meeting.findMany({
    where: {
      isHidden: false,
      OR: [
        { createdById: session.user.id },
        { members: { some: { userId: session.user.id } } },
        {
          isPublic: true,
          dataspace: {
            members: { some: { userId: session.user.id } }
          }
        }
      ]
    },
    orderBy: { createdAt: "desc" },
    include: {
      members: {
        where: { userId: session.user.id }
      }
    }
  });

  return NextResponse.json({ meetings });
}
