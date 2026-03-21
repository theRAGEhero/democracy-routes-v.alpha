import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MeetingsTable } from "@/app/dashboard/MeetingsTable";
import { formatDateTime, isMeetingActive } from "@/lib/utils";

export default async function GlobalDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  if (session.user.role !== "ADMIN") {
    return <p className="text-sm text-slate-500">Access denied.</p>;
  }

  const [meetings, dataspaces, flows, texts] = await Promise.all([
    prisma.meeting.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { email: true } },
        dataspace: { select: { id: true, name: true, personalOwnerId: true } }
      }
    }),
    prisma.dataspace.findMany({
      where: { isPrivate: false },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, personalOwnerId: true }
    }),
    prisma.plan.findMany({
      orderBy: { startAt: "desc" },
      select: {
        id: true,
        title: true,
        startAt: true,
        timezone: true,
        roundsCount: true,
        isPublic: true,
        dataspace: { select: { id: true, name: true, personalOwnerId: true } }
      }
    }),
    prisma.text.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        dataspace: { select: { id: true, name: true, personalOwnerId: true } }
      }
    })
  ]);

  const now = new Date();
  const rows = meetings.map((meeting: (typeof meetings)[number]) => ({
    id: meeting.id,
    title: meeting.title,
    statusLabel: isMeetingActive(meeting) ? "Active" : "Expired",
    scheduledLabel: formatDateTime(meeting.scheduledStartAt, meeting.timezone) ?? "Not scheduled",
    expiresLabel: formatDateTime(meeting.expiresAt, meeting.timezone),
    language: meeting.language,
    providerLabel:
      meeting.transcriptionProvider === "VOSK"
        ? "Vosk"
        : meeting.transcriptionProvider === "AUTOREMOTE"
          ? "Auto Remote"
        : meeting.transcriptionProvider === "WHISPERREMOTE"
          ? "Whisper Remote"
          : meeting.transcriptionProvider === "DEEPGRAMLIVE"
          ? "Deepgram Live"
          : "Deepgram",
    dataspaceLabel:
      meeting.dataspace?.personalOwnerId === session.user.id
        ? "My Data Space"
        : meeting.dataspace?.name ?? "No dataspace",
    dataspaceKey:
      meeting.dataspace?.personalOwnerId === session.user.id
        ? "personal"
        : meeting.dataspace?.id ?? "none",
    isPublic: meeting.isPublic,
    isHidden: meeting.isHidden,
    isPast: Boolean(
      (meeting.expiresAt && meeting.expiresAt < now) ||
        (!meeting.expiresAt && meeting.scheduledStartAt && meeting.scheduledStartAt < now && !meeting.isActive)
    ),
    joinStatus: "NONE" as const,
    canJoin: false,
    createdByEmail: meeting.createdBy.email,
    canDelete: true
  }));

  const dataspaceOptions = [
    { key: "personal", label: "My Data Space" },
    { key: "none", label: "No dataspace" },
    ...dataspaces.map((dataspace: (typeof dataspaces)[number]) => ({
      key: dataspace.id,
      label: dataspace.name
    }))
  ];

  const planRows = flows.map((plan: (typeof flows)[number]) => ({
    id: plan.id,
    title: plan.title,
    startLabel: formatDateTime(plan.startAt, plan.timezone),
    startAtMs: plan.startAt.getTime(),
    isPast: plan.startAt < now,
    roundsCount: plan.roundsCount,
    dataspaceLabel:
      plan.dataspace?.personalOwnerId === session.user.id
        ? "My Data Space"
        : plan.dataspace?.name ?? "No dataspace",
    dataspaceKey:
      plan.dataspace?.personalOwnerId === session.user.id
        ? "personal"
        : plan.dataspace?.id ?? "none",
    isPublic: plan.isPublic,
    joinStatus: "NONE" as const,
    canJoin: false
  }));

  const textRows = texts.map((text: (typeof texts)[number]) => {
    const snippet = text.content.trim().split("\n")[0]?.slice(0, 80) ?? "";
    return {
      id: text.id,
      snippet,
      updatedLabel: formatDateTime(text.updatedAt),
      isPast: text.updatedAt < now,
      dataspaceLabel:
        text.dataspace?.personalOwnerId === session.user.id
          ? "My Data Space"
        : text.dataspace?.name ?? "Personal",
      dataspaceKey:
        text.dataspace?.personalOwnerId === session.user.id
          ? "personal"
          : text.dataspace?.id ?? "none"
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          Global dashboard
        </h1>
        <p className="text-sm text-slate-600">All meetings and templates across the platform.</p>
      </div>
      <MeetingsTable
        initialMeetings={rows}
        dataspaceOptions={dataspaceOptions}
        flows={planRows}
        texts={textRows}
        showCreatedBy
        showFlagFilters
      />
    </div>
  );
}
