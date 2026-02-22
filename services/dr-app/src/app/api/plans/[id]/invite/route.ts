import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { sendMail } from "@/lib/mailer";
import { inviteMemberSchema } from "@/lib/validators";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { checkRateLimit, getRequestIp } from "@/lib/rateLimit";

function generateToken() {
  return crypto.randomBytes(24).toString("base64url");
}

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
    key: `plan-invite:${session.user.id}:${ip}`,
    limit: 20,
    windowMs: 10 * 60 * 1000
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many invites. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const plan = await prisma.plan.findUnique({
    where: { id: params.id },
    include: {
      rounds: { select: { id: true } }
    }
  });

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isOwner = plan.createdById === session.user.id;
  let isDataspaceMember = false;

  if (plan.dataspaceId) {
    const member = await prisma.dataspaceMember.findUnique({
      where: {
        dataspaceId_userId: {
          dataspaceId: plan.dataspaceId,
          userId: session.user.id
        }
      }
    });
    isDataspaceMember = Boolean(member);
  }

  if (!isAdmin && !isOwner && !(plan.isPublic && isDataspaceMember)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = inviteMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const targetEmail = parsed.data.email.toLowerCase();
  let user = await prisma.user.findUnique({
    where: { email: targetEmail }
  });

  const needsGuestInvite = !user || user.isGuest;
  if (needsGuestInvite) {
    if (!user) {
      const tempPassword = crypto.randomBytes(32).toString("base64url");
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      user = await prisma.user.create({
        data: {
          email: targetEmail,
          passwordHash,
          role: "USER",
          isGuest: true,
          mustChangePassword: false,
          emailVerifiedAt: null
        }
      });
    }
  }

  if (!user) {
    return NextResponse.json({ error: "Unable to prepare invite" }, { status: 500 });
  }

  if (plan.dataspaceId && user && !user.isGuest) {
    const member = await prisma.dataspaceMember.findUnique({
      where: {
        dataspaceId_userId: {
          dataspaceId: plan.dataspaceId,
          userId: user.id
        }
      }
    });
    if (!member) {
      return NextResponse.json({ error: "User is not in the dataspace" }, { status: 400 });
    }
  }

  const fixedParticipant = await prisma.planPair.findFirst({
    where: {
      planRound: { planId: plan.id },
      OR: [{ userAId: user.id }, { userBId: user.id }]
    },
    select: { id: true }
  });

  if (fixedParticipant) {
    return NextResponse.json({ message: "User is already assigned to the plan" });
  }

  const existingParticipant = await prisma.planParticipant.findUnique({
    where: {
      planId_userId: {
        planId: plan.id,
        userId: user.id
      }
    }
  });

  if (!existingParticipant) {
    const approvedCount = await prisma.planParticipant.count({
      where: {
        planId: plan.id,
        status: "APPROVED"
      }
    });
    const fixedPairs = await prisma.planPair.findMany({
      where: { planRound: { planId: plan.id } },
      select: { userAId: true, userBId: true }
    });
    const fixedUsers = new Set<string>();
    fixedPairs.forEach((pair: (typeof fixedPairs)[number]) => {
      fixedUsers.add(pair.userAId);
      if (pair.userBId) fixedUsers.add(pair.userBId);
    });

    if (!plan.requiresApproval && plan.capacity && approvedCount + fixedUsers.size >= plan.capacity) {
      return NextResponse.json({ error: "Plan is full" }, { status: 400 });
    }

    await prisma.planParticipant.create({
      data: {
        planId: plan.id,
        userId: user.id,
        status: plan.requiresApproval ? "PENDING" : "APPROVED"
      }
    });
  }

  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3015";
  if (needsGuestInvite) {
    const token = generateToken();
    const invite = await prisma.planGuestInvite.upsert({
      where: {
        planId_email: {
          planId: plan.id,
          email: targetEmail
        }
      },
      update: {
        token,
        userId: user.id
      },
      create: {
        planId: plan.id,
        createdById: session.user.id,
        userId: user.id,
        email: targetEmail,
        token
      }
    });
    const guestLink = `${appBaseUrl}/guest/plans/${invite.token}`;
    const registerLink = `${appBaseUrl}/register`;
    const emailResult = await sendMail({
      to: user.email,
      subject: "You are invited to a plan",
      html: `<p>You have been invited to the plan <strong>${plan.title}</strong>.</p>
        <p>Join without registration: <a href="${guestLink}">${guestLink}</a></p>
        <p>Prefer to register? Create an account: <a href="${registerLink}">${registerLink}</a></p>`,
      text: `You have been invited to the plan ${plan.title}. Join without registration: ${guestLink}. Register: ${registerLink}`
    });

    return NextResponse.json({
      message: "Guest invite sent",
      emailSent: emailResult.ok
    });
  }

  const emailResult = await sendMail({
    to: user.email,
    subject: "You are invited to a plan",
    html: `<p>You have been invited to the plan <strong>${plan.title}</strong>.</p>
      <p>Open the plan: <a href="${appBaseUrl}/plans/${plan.id}">${appBaseUrl}/plans/${plan.id}</a></p>`,
    text: `You have been invited to the plan ${plan.title}. Open: ${appBaseUrl}/plans/${plan.id}`
  });

  return NextResponse.json({
    message: "Invite sent",
    emailSent: emailResult.ok
  });
}
