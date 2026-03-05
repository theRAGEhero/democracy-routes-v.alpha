import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_DATASPACE_COLOR } from "@/lib/dataspaceColor";
import { CallLanding } from "@/app/call/CallLanding";

const DEMOCRACY_ROUTES_DATASPACE = "Democracy Routes";

export default async function CallPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  let dataspace = await prisma.dataspace.findFirst({
    where: { name: DEMOCRACY_ROUTES_DATASPACE, isPrivate: false },
    orderBy: { createdAt: "desc" }
  });

  if (!dataspace) {
    dataspace = await prisma.dataspace.create({
      data: {
        name: DEMOCRACY_ROUTES_DATASPACE,
        description: "Open calls created from the Democracy Routes call launcher.",
        color: DEFAULT_DATASPACE_COLOR,
        createdById: session.user.id,
        isPrivate: false,
        members: {
          create: { userId: session.user.id }
        },
        subscriptions: {
          create: {
            userId: session.user.id,
            notifyAllActivity: true,
            notifyMeetings: true,
            notifyPlans: true,
            notifyTexts: true
          }
        }
      }
    });
  } else {
    await prisma.dataspaceMember.upsert({
      where: {
        dataspaceId_userId: {
          dataspaceId: dataspace.id,
          userId: session.user.id
        }
      },
      update: {},
      create: {
        dataspaceId: dataspace.id,
        userId: session.user.id
      }
    });

    await prisma.dataspaceSubscription.upsert({
      where: {
        dataspaceId_userId: {
          dataspaceId: dataspace.id,
          userId: session.user.id
        }
      },
      update: {},
      create: {
        dataspaceId: dataspace.id,
        userId: session.user.id,
        notifyAllActivity: dataspace.notifyAllActivity,
        notifyMeetings: dataspace.notifyMeetings,
        notifyPlans: dataspace.notifyPlans,
        notifyTexts: dataspace.notifyTexts
      }
    });
  }

  return (
    <div className="w-full px-4 py-10 sm:px-6 lg:px-10">
      <CallLanding dataspaceId={dataspace.id} dataspaceName={dataspace.name} />
    </div>
  );
}
