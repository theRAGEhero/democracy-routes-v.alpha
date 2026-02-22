import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { inviteMemberSchema } from "@/lib/validators";
import { getSession } from "@/lib/session";
import { sendMail } from "@/lib/mailer";
import { checkRateLimit, getRequestIp } from "@/lib/rateLimit";
import crypto from "crypto";

function generateToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getRequestIp(request);
  const rate = checkRateLimit({
    key: `meeting-member-invite:${session.user.id}:${ip}`,
    limit: 20,
    windowMs: 10 * 60 * 1000
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many invites. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = inviteMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
    include: {
      members: {
        where: { userId: session.user.id }
      },
      dataspace: {
        include: { members: { select: { userId: true } } }
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
  const isDataspaceMember = meeting.dataspace
    ? meeting.dataspace.members.some(
        (member: (typeof meeting.dataspace.members)[number]) =>
          member.userId === session.user.id
      )
    : false;

  if (!isAdmin && !isHost && !(meeting.isPublic && isDataspaceMember)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invitee = await prisma.user.findUnique({
    where: { email: parsed.data.email }
  });

  if (!invitee || invitee.isGuest) {
    const token = generateToken();
    const expiresAt = meeting.expiresAt ?? null;
    const invite = await prisma.meetingGuestInvite.upsert({
      where: {
        meetingId_email: {
          meetingId: meeting.id,
          email: parsed.data.email.toLowerCase()
        }
      },
      update: {
        token,
        expiresAt
      },
      create: {
        meetingId: meeting.id,
        createdById: session.user.id,
        email: parsed.data.email.toLowerCase(),
        token,
        expiresAt
      }
    });

    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    const guestLink = `${appBaseUrl}/guest/meetings/${invite.token}`;
    const registerLink = `${appBaseUrl}/register`;
    const emailResult = await sendMail({
      to: invite.email,
      subject: "You are invited to a meeting",
      html: `<p>You have been invited to the meeting <strong>${meeting.title}</strong>.</p>
        <p>Join without registration: <a href="${guestLink}">${guestLink}</a></p>
        <p>Prefer to register? Create an account: <a href="${registerLink}">${registerLink}</a></p>`,
      text: `You have been invited to the meeting ${meeting.title}. Join without registration: ${guestLink}. Register: ${registerLink}`
    });

    return NextResponse.json({
      message: "Guest invite sent",
      emailSent: emailResult.ok,
      emailError: emailResult.ok ? null : emailResult.error
    });
  }

  const existing = await prisma.meetingMember.findUnique({
    where: {
      meetingId_userId: {
        meetingId: meeting.id,
        userId: invitee.id
      }
    }
  });

  if (existing) {
    return NextResponse.json({ message: "User already a member" });
  }

  const existingInvite = await prisma.meetingInvite.findUnique({
    where: {
      meetingId_userId: {
        meetingId: meeting.id,
        userId: invitee.id
      }
    }
  });

  if (existingInvite && existingInvite.status === "PENDING") {
    return NextResponse.json({ message: "User already invited" });
  }

  if (existingInvite && existingInvite.status === "ACCEPTED") {
    return NextResponse.json({ message: "User already accepted the invite" });
  }

  if (existingInvite && existingInvite.status === "DECLINED") {
    await prisma.meetingInvite.update({
      where: { id: existingInvite.id },
      data: { status: "PENDING" }
    });
  } else if (!existingInvite) {
    await prisma.meetingInvite.create({
      data: {
        meetingId: meeting.id,
        userId: invitee.id,
        status: "PENDING"
      }
    });
  }

  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const emailResult = await sendMail({
    to: invitee.email,
    subject: "You are invited to a meeting",
    html: `<p>You have been invited to the meeting <strong>${meeting.title}</strong>.</p>
      <p>Open the meeting page: <a href="${appBaseUrl}/meetings/${meeting.id}">${appBaseUrl}/meetings/${meeting.id}</a></p>`,
    text: `You have been invited to the meeting ${meeting.title}. Open: ${appBaseUrl}/meetings/${meeting.id}`
  });

  return NextResponse.json({
    message: "User invited",
    emailSent: emailResult.ok,
    emailError: emailResult.ok ? null : emailResult.error
  });
}
