import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DataspaceClient } from "@/app/dataspace/DataspaceClient";
import { DEFAULT_DATASPACE_COLOR } from "@/lib/dataspaceColor";

export default async function DataspacePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, telegramHandle: true }
  });

  if (!currentUser) {
    return (
      <div className="text-sm text-slate-600">
        Session is out of date. Please sign out and sign in again.
      </div>
    );
  }

  const [personalDataspace, subscriptions] = await Promise.all([
    prisma.dataspace.findFirst({
    where: { personalOwnerId: session.user.id },
    include: {
      createdBy: { select: { email: true } },
      members: {
        include: { user: { select: { email: true } } }
      },
      meetings: { where: { isHidden: false }, select: { id: true } },
      plans: { select: { id: true } },
      texts: { select: { id: true } }
    }
  }),
    prisma.dataspaceSubscription.findMany({
      where: { userId: session.user.id },
      select: { dataspaceId: true }
    })
  ]);

  const subscribedIds = new Set(
    subscriptions.map((sub: (typeof subscriptions)[number]) => sub.dataspaceId)
  );

  const ensuredPersonal =
    personalDataspace ??
    (await prisma.dataspace.create({
      data: {
        name: "My Data Space",
        description: "Private dataspace owned by you.",
        color: DEFAULT_DATASPACE_COLOR,
        createdById: session.user.id,
        personalOwnerId: session.user.id,
        isPrivate: true,
        members: {
          create: {
            userId: session.user.id
          }
        },
        subscriptions: {
          create: {
            userId: session.user.id
          }
        }
      },
      include: {
        createdBy: { select: { email: true } },
        members: {
          include: { user: { select: { email: true } } }
        },
        meetings: { where: { isHidden: false }, select: { id: true } },
        plans: { select: { id: true } },
        texts: { select: { id: true } }
      }
    }));

  const dataspaces = await prisma.dataspace.findMany({
    where: { isPrivate: false, personalOwnerId: null },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { email: true } },
      members: {
        include: { user: { select: { email: true } } }
      },
      meetings: { where: { isHidden: false }, select: { id: true } },
      plans: { select: { id: true } },
      texts: { select: { id: true } }
    }
  });

  const payload = dataspaces.map((space: (typeof dataspaces)[number]) => ({
    id: space.id,
    name: space.name,
    description: space.description,
    color: space.color,
    imageUrl: space.imageUrl ?? null,
    createdByEmail: space.createdBy.email,
    members: space.members.map(
      (member: (typeof space.members)[number]) => ({
      id: member.userId,
      email: member.user.email
      })
    ),
    isPrivate: space.isPrivate,
    meetingsCount: space.meetings.length,
    plansCount: space.plans.length,
    textsCount: space.texts.length,
    isSubscribed: subscribedIds.has(space.id)
  }));

  const isAdmin = session.user.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          Dataspace
        </h1>
      </div>
      <DataspaceClient
        initialDataspaces={payload}
        currentUserId={session.user.id}
        isAdmin={isAdmin}
        hasTelegramHandle={Boolean(currentUser.telegramHandle)}
        personalDataspace={{
          id: ensuredPersonal.id,
          name: ensuredPersonal.name,
          description: ensuredPersonal.description,
          color: ensuredPersonal.color,
          imageUrl: ensuredPersonal.imageUrl ?? null,
          createdByEmail: ensuredPersonal.createdBy.email,
          members: ensuredPersonal.members.map(
            (member: (typeof ensuredPersonal.members)[number]) => ({
              id: member.userId,
              email: member.user.email
            })
          ),
          isPrivate: ensuredPersonal.isPrivate,
          meetingsCount: ensuredPersonal.meetings.length,
          plansCount: ensuredPersonal.plans.length,
          textsCount: ensuredPersonal.texts.length,
    isSubscribed: subscribedIds.has(ensuredPersonal.id)
        }}
      />
    </div>
  );
}
