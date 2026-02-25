import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime, isMeetingActive } from "@/lib/utils";
import { EmbedCall } from "@/app/meetings/[id]/EmbedCall";
import { MeetingActions } from "@/app/meetings/[id]/MeetingActions";
import { TranscriptionAutoLink } from "@/app/meetings/[id]/TranscriptionAutoLink";
import { MeetingInviteActions } from "@/app/meetings/[id]/MeetingInviteActions";
import { MeetingParticipation } from "@/app/meetings/[id]/MeetingParticipation";
import { buildCallJoinUrl, buildDisplayName, normalizeCallBaseUrl } from "@/lib/callUrl";

export default async function MeetingDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
    include: {
      members: {
        include: { user: true }
      },
      invites: {
        include: { user: true }
      },
      dataspace: {
        include: { members: { select: { userId: true } } }
      }
    }
  });

  if (!meeting) {
    return <div className="text-sm text-slate-500">Meeting not found.</div>;
  }

  const isAdmin = session.user.role === "ADMIN";
  const membership = meeting.members.find(
    (member: (typeof meeting.members)[number]) =>
      member.userId === session.user.id
  );
  const isDataspaceMember = meeting.dataspace
    ? meeting.dataspace.members.some(
        (member: (typeof meeting.dataspace.members)[number]) =>
          member.userId === session.user.id
      )
    : false;
  const pendingInvite = await prisma.meetingInvite.findUnique({
    where: {
      meetingId_userId: {
        meetingId: params.id,
        userId: session.user.id
      }
    }
  });

  const canAccess =
    isAdmin ||
    Boolean(membership) ||
    pendingInvite?.status === "ACCEPTED" ||
    (meeting.isPublic && isDataspaceMember);

  if (!canAccess) {
    if (pendingInvite?.status === "PENDING") {
      return (
        <MeetingInviteActions
          inviteId={pendingInvite.id}
          meetingTitle={meeting.title}
          hostEmail={
            meeting.members.find(
              (member: (typeof meeting.members)[number]) => member.role === "HOST"
            )?.user.email ?? "Host"
          }
        />
      );
    }
    return <div className="text-sm text-slate-500">You do not have access to this meeting.</div>;
  }

  const canManage = isAdmin || membership?.role === "HOST";
  const canInvite = canManage || (meeting.isPublic && isDataspaceMember);
  const active = isMeetingActive(meeting);
  const isConcluded = !meeting.isActive || (meeting.expiresAt ? meeting.expiresAt.getTime() < Date.now() : false);
  const canEdit = (isAdmin || membership?.role === "HOST" || meeting.createdById === session.user.id) && !isConcluded;
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true }
  });
  const callDisplayName = buildDisplayName(null, session.user.id);
  const baseUrl = normalizeCallBaseUrl(process.env.DEMOCRACYROUTES_CALL_BASE_URL || "");
  const langCode = meeting.language === "IT" ? "it" : "en";
  const transcriptionLanguage =
    meeting.transcriptionProvider === "DEEPGRAMLIVE" ? langCode : "";

  const embedUrl = buildCallJoinUrl({
    baseUrl,
    roomId: meeting.roomId,
    meetingId: meeting.id,
    name: callDisplayName,
    autojoin: true,
    embed: true,
    autoRecordVideo: true,
    transcriptionLanguage
  });
  const joinUrl = buildCallJoinUrl({
    baseUrl,
    roomId: meeting.roomId,
    meetingId: meeting.id,
    name: callDisplayName,
    autojoin: true,
    autoRecordVideo: true,
    transcriptionLanguage
  });

  const statusLabel = active ? "Active" : "Expired";
  const languageLabel = meeting.language;
  const providerLabel =
    meeting.transcriptionProvider === "VOSK"
      ? "Vosk (privacy friendly)"
      : meeting.transcriptionProvider === "DEEPGRAMLIVE"
        ? "Deepgram Live"
        : "Deepgram";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
            {meeting.title}
          </h1>
          {meeting.description ? (
            <p className="mt-2 text-sm text-slate-600">{meeting.description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {canEdit ? (
            <Link
              href={`/meetings/${meeting.id}/edit`}
              className="dr-button-outline px-3 py-1 text-xs"
            >
              Edit meeting
            </Link>
          ) : null}
          <Link
            href="/dashboard"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Back to dashboard
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="order-1 flex-1 lg:order-2">
          <EmbedCall
            embedUrl={embedUrl}
            isActive={active}
            hasBaseUrl={Boolean(baseUrl)}
            statusLabel={statusLabel}
            languageLabel={languageLabel}
            providerLabel={providerLabel}
            joinUrl={joinUrl}
            meetingId={meeting.id}
            canManage={canManage}
          />
        </div>
      </div>

      <div className="dr-card p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Expires</p>
            <p className="text-sm text-slate-700">
              {formatDateTime(meeting.expiresAt, meeting.timezone)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Starts</p>
            <p className="text-sm text-slate-700">
              {meeting.scheduledStartAt
                ? formatDateTime(meeting.scheduledStartAt, meeting.timezone)
                : "Not scheduled"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Host</p>
            <p className="text-sm text-slate-700">
              {meeting.members.find(
                (member: (typeof meeting.members)[number]) =>
                  member.role === "HOST"
              )?.user.email ?? "-"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Room</p>
            <p className="text-sm text-slate-700 break-all">{meeting.roomId}</p>
          </div>
        </div>
      </div>

      <MeetingParticipation
        meetingId={meeting.id}
        isPublic={meeting.isPublic}
        requiresApproval={meeting.requiresApproval}
        capacity={meeting.capacity}
        isDataspaceMember={isDataspaceMember}
        isMember={Boolean(membership)}
        pendingStatus={pendingInvite?.status ?? null}
        pendingRequests={meeting.invites
          .filter(
            (invite: (typeof meeting.invites)[number]) =>
              invite.status === "PENDING"
          )
          .map((invite: (typeof meeting.invites)[number]) => ({
            id: invite.id,
            email: invite.user.email
          }))}
        canManageRequests={canManage}
      />
      <MeetingActions meetingId={meeting.id} canInvite={canInvite} isActive={meeting.isActive} />
      <TranscriptionAutoLink
        meetingId={meeting.id}
        canManage={canManage}
        initialRoundId={meeting.transcriptionRoundId}
      />
    </div>
  );
}
