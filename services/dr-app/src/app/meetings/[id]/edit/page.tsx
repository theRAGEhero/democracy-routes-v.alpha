import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewMeetingForm } from "@/app/meetings/new/NewMeetingForm";

export default async function EditMeetingPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
    include: {
      members: { select: { userId: true, role: true } },
      aiAgents: { select: { agentId: true } }
    }
  });

  if (!meeting) {
    return <p className="text-sm text-slate-500">Meeting not found.</p>;
  }

  const isAdmin = session.user.role === "ADMIN";
  const isHost = meeting.members.some(
    (member: (typeof meeting.members)[number]) =>
      member.userId === session.user.id && member.role === "HOST"
  );
  const isCreator = meeting.createdById === session.user.id;
  const canEdit = isAdmin || isHost || isCreator;

  if (!canEdit) {
    return <p className="text-sm text-slate-500">Access denied.</p>;
  }

  const dataspaces = await prisma.dataspace.findMany({
    where: { members: { some: { userId: session.user.id } } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true }
  });

  return (
    <div className="mx-auto flex w-full justify-center px-4 sm:px-6">
      <div className="w-full max-w-2xl space-y-4">
        <div className="text-center sm:text-left">
          <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
            Edit meeting
          </h1>
          <p className="text-sm text-slate-500">Update meeting details.</p>
        </div>
        <div className="dr-card p-6">
          <NewMeetingForm
            dataspaces={dataspaces}
            mode="edit"
            initialMeeting={{
              id: meeting.id,
              title: meeting.title,
              description: meeting.description,
              scheduledStartAt: meeting.scheduledStartAt?.toISOString() ?? null,
              expiresAt: meeting.expiresAt?.toISOString() ?? null,
              language: meeting.language,
              transcriptionProvider: meeting.transcriptionProvider,
              timezone: meeting.timezone ?? null,
              dataspaceId: meeting.dataspaceId,
              isPublic: meeting.isPublic,
              requiresApproval: meeting.requiresApproval,
              capacity: meeting.capacity,
              aiAgentIds: meeting.aiAgents.map((item) => item.agentId),
              speakingBalanceModeratorEnabled: meeting.speakingBalanceModeratorEnabled,
              speakingBalanceModeratorPreset:
                meeting.speakingBalanceModeratorPreset === "strict" ? "strict" : "gentle",
              speakingBalanceAllowParticipantUnmute: meeting.speakingBalanceAllowParticipantUnmute
            }}
          />
        </div>
      </div>
    </div>
  );
}
