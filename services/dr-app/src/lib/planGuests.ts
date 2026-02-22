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
      inviteId: null
    };
  }

  const token = readGuestToken(request);
  if (!token) {
    return null;
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
    inviteId: invite.id
  };
}
