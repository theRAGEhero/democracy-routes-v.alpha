import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { inviteMemberSchema } from "@/lib/validators";
import { sendMail } from "@/lib/mailer";
import { checkRateLimit, getRequestIp } from "@/lib/rateLimit";
import { sendTelegramInvite } from "@/lib/telegramInvites";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getRequestIp(request);
  const rate = checkRateLimit({
    key: `dataspace-invite:${session.user.id}:${ip}`,
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

  const dataspace = await prisma.dataspace.findUnique({
    where: { id: params.id },
    select: { id: true, createdById: true, personalOwnerId: true, isPrivate: true, name: true }
  });

  if (!dataspace) {
    return NextResponse.json({ error: "Dataspace not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isOwner =
    dataspace.personalOwnerId === session.user.id || dataspace.createdById === session.user.id;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const normalizedEmail = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      notifyEmailDataspaceInvites: true,
      notifyTelegramDataspaceInvites: true,
      telegramHandle: true,
      telegramChatId: true
    }
  });

  if (user) {
    const existingMember = await prisma.dataspaceMember.findUnique({
      where: {
        dataspaceId_userId: {
          dataspaceId: dataspace.id,
          userId: user.id
        }
      }
    });

    if (existingMember) {
      return NextResponse.json({ message: "User already a member" });
    }

    const invite = await prisma.dataspaceInvite.findUnique({
      where: {
        dataspaceId_userId: {
          dataspaceId: dataspace.id,
          userId: user.id
        }
      }
    });

    if (invite?.status === "PENDING") {
      return NextResponse.json({ message: "User already invited" });
    }

    if (invite?.status === "ACCEPTED") {
      return NextResponse.json({ message: "User already accepted the invite" });
    }

    if (invite?.status === "DECLINED") {
      await prisma.dataspaceInvite.update({
        where: { id: invite.id },
        data: { status: "PENDING" }
      });
    } else if (!invite) {
      await prisma.dataspaceInvite.create({
        data: {
          dataspaceId: dataspace.id,
          userId: user.id,
          status: "PENDING"
        }
      });
    }

    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3015";
    const dataspaceUrl = `${appBaseUrl}/dataspace/${dataspace.id}`;
    const emailResult = user.notifyEmailDataspaceInvites
      ? await sendMail({
          to: user.email,
          subject: "You are invited to a dataspace",
          html: `<p>You have been invited to the dataspace <strong>${dataspace.name}</strong>.</p>
            <p>Open the dataspace: <a href="${dataspaceUrl}">${dataspaceUrl}</a></p>`,
          text: `You have been invited to the dataspace ${dataspace.name}. Open: ${dataspaceUrl}`
        })
      : { ok: false };
    await sendTelegramInvite(
      user,
      user.notifyTelegramDataspaceInvites,
      "dataspace",
      dataspace.name,
      dataspaceUrl
    );

    return NextResponse.json({
      message: "Invite sent",
      emailSent: emailResult.ok
    });
  }

  const existingGuest = await prisma.dataspaceGuestInvite.findUnique({
    where: {
      dataspaceId_email: {
        dataspaceId: dataspace.id,
        email: normalizedEmail
      }
    }
  });

  if (existingGuest?.status === "PENDING") {
    return NextResponse.json({ message: "User already invited" });
  }

  if (existingGuest?.status === "ACCEPTED") {
    return NextResponse.json({ message: "User already accepted the invite" });
  }

  if (existingGuest?.status === "DECLINED") {
    await prisma.dataspaceGuestInvite.update({
      where: { id: existingGuest.id },
      data: { status: "PENDING" }
    });
  } else if (!existingGuest) {
    await prisma.dataspaceGuestInvite.create({
      data: {
        dataspaceId: dataspace.id,
        createdById: session.user.id,
        email: normalizedEmail,
        status: "PENDING"
      }
    });
  }

  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3015";
  const dataspaceUrl = `${appBaseUrl}/dataspace/${dataspace.id}`;
  const emailResult = await sendMail({
    to: normalizedEmail,
    subject: "You are invited to a dataspace",
    html: `<p>You have been invited to the dataspace <strong>${dataspace.name}</strong>.</p>
      <p>Open the dataspace: <a href="${dataspaceUrl}">${dataspaceUrl}</a></p>
      <p>Create an account to join: <a href="${appBaseUrl}/register">${appBaseUrl}/register</a></p>`,
    text: `You have been invited to the dataspace ${dataspace.name}. Open: ${dataspaceUrl} Register: ${appBaseUrl}/register`
  });

  return NextResponse.json({
    message: "Invite sent (registration required)",
    emailSent: emailResult.ok
  });
}
