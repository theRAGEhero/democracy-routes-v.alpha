import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type PlanViewer = {
  user: {
    id: string;
    email: string;
    role: string;
    isGuest: boolean;
  };
  isGuest: boolean;
  inviteId: string | null;
  participantSessionId: string | null;
  guestDisplayName?: string | null;
};

function readGuestToken(request: Request) {
  const url = new URL(request.url);
  return url.searchParams.get("guest_token") || request.headers.get("x-guest-token");
}

export async function getPlanViewer(request: Request, planId: string): Promise<PlanViewer | null> {
  const session = await getSession();
  if (session?.user) {
    return {
      user: {
        id: session.user.id,
        email: session.user.email ?? "",
        role: session.user.role,
        isGuest: false
      },
      isGuest: false,
      inviteId: null,
      participantSessionId: null,
      guestDisplayName: null
    };
  }

  const token = readGuestToken(request);
  if (!token) {
    return null;
  }

  const participantSession = await prisma.planParticipantSession.findUnique({
    where: { guestToken: token }
  });

  if (participantSession && participantSession.planId === planId) {
    return {
      user: {
        id: participantSession.userId ?? "",
        email: participantSession.guestEmail ?? participantSession.displayName,
        role: "USER",
        isGuest: true
      },
      isGuest: true,
      inviteId: null,
      participantSessionId: participantSession.id,
      guestDisplayName: participantSession.displayName
    };
  }

  const invite = await prisma.planGuestInvite.findUnique({
    where: { token },
    include: { user: true }
  });

  if (!invite || invite.planId !== planId) {
    return null;
  }

  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return null;
  }

  return {
    user: {
      id: invite.user.id,
      email: invite.user.email,
      role: invite.user.role,
      isGuest: invite.user.isGuest
    },
    isGuest: true,
    inviteId: invite.id,
    participantSessionId: null,
    guestDisplayName: invite.email
  };
}
