import Link from "next/link";
import type { CSSProperties } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime, isMeetingActive } from "@/lib/utils";
import { MeetingActions } from "@/app/meetings/[id]/MeetingActions";
import { MeetingInviteActions } from "@/app/meetings/[id]/MeetingInviteActions";
import { MeetingParticipation } from "@/app/meetings/[id]/MeetingParticipation";
import { buildCallJoinUrl, buildDisplayName, normalizeCallBaseUrl } from "@/lib/callUrl";
import { buildVideoAccessToken } from "@/lib/videoAccess";
import { MeetingDetailClient } from "@/app/meetings/[id]/MeetingDetailClient";
import { DEFAULT_DATASPACE_COLOR, getDataspaceTheme } from "@/lib/dataspaceColor";
import { chooseAutoRemoteAssignee, parseAutoRemoteAssignment } from "@/lib/autoRemoteAssignment";
import { getTranscriptionProviderLabel, isLiveTranscriptionProvider } from "@/lib/transcriptionProviders";

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
      aiSummary: {
        select: {
          generatedTitle: true,
          generatedDescription: true,
          status: true
        }
      },
      invites: {
        include: { user: true }
      },
      dataspace: {
        include: { members: { select: { userId: true } } }
      },
      aiAgents: {
        include: {
          agent: {
            select: {
              id: true,
              name: true,
              username: true,
              color: true,
              enabled: true
            }
          }
        }
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
  const hostMember =
    meeting.members.find(
      (member: (typeof meeting.members)[number]) => member.role === "HOST"
    ) ?? null;
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true }
  });
  const callDisplayName = buildDisplayName(currentUser?.email ?? null, session.user.id);
  const baseUrl = normalizeCallBaseUrl(process.env.DEMOCRACYROUTES_CALL_BASE_URL || "");
  const langCode = meeting.language === "IT" ? "it" : "en";
  const liveTranscriptionEnabled = isLiveTranscriptionProvider(meeting.transcriptionProvider);
  const recordingEnabled = ["DEEPGRAM", "DEEPGRAMLIVE", "GLADIALIVE", "VOSK", "WHISPERREMOTE", "AUTOREMOTE"].includes(
    meeting.transcriptionProvider
  );
  const postCallTranscriptEnabled = !isLiveTranscriptionProvider(meeting.transcriptionProvider);
  const transcriptionLanguage = liveTranscriptionEnabled ? langCode : "";
  const drAppBaseUrl = process.env.APP_BASE_URL || "";
  const accessToken = buildVideoAccessToken({
    roomId: meeting.roomId,
    meetingId: meeting.id,
    userId: session.user.id,
    userEmail: currentUser?.email ?? session.user.email
  });

  const embedUrl = buildCallJoinUrl({
    baseUrl,
    roomId: meeting.roomId,
    meetingId: meeting.id,
    name: callDisplayName,
    autojoin: true,
    embed: true,
    autoRecordVideo: recordingEnabled,
    transcriptionLanguage,
    drAppBaseUrl,
    accessToken
  });
  const joinUrl = buildCallJoinUrl({
    baseUrl,
    roomId: meeting.roomId,
    meetingId: meeting.id,
    name: callDisplayName,
    autojoin: true,
    autoRecordVideo: recordingEnabled,
    transcriptionLanguage,
    drAppBaseUrl,
    accessToken
  });

  const statusLabel = active ? "Active" : "Expired";
  const languageLabel = meeting.language;
  const providerLabel =
    meeting.transcriptionProvider === "VOSK"
      ? "Vosk (privacy friendly)"
      : getTranscriptionProviderLabel(meeting.transcriptionProvider);
  const theme = getDataspaceTheme(meeting.dataspace?.color ?? DEFAULT_DATASPACE_COLOR);
  const displayTitle =
    meeting.aiSummary?.status === "DONE" && meeting.aiSummary.generatedTitle?.trim()
      ? meeting.aiSummary.generatedTitle.trim()
      : meeting.title;
  const displayDescription =
    meeting.aiSummary?.status === "DONE" && meeting.aiSummary.generatedDescription?.trim()
      ? meeting.aiSummary.generatedDescription.trim()
      : meeting.description;
  const latestRemoteWorkerJob =
    meeting.transcriptionProvider === "AUTOREMOTE"
      ? await prisma.remoteWorkerJob.findFirst({
          where: {
            sourceType: "MEETING_RECORDING",
            sourceId: meeting.id
          },
          orderBy: { updatedAt: "desc" },
          select: {
            payloadJson: true
          }
        })
      : null;
  const autoRemoteAssignment =
    parseAutoRemoteAssignment(latestRemoteWorkerJob?.payloadJson) ??
    (meeting.transcriptionProvider === "AUTOREMOTE"
      ? chooseAutoRemoteAssignee(
          meeting.members.map((member) => ({
            userId: member.userId,
            role: member.role,
            createdAt: member.createdAt,
            user: { email: member.user.email }
          }))
        )
      : null);

  return (
    <div className="dataspace-theme dataspace-theme-tight" style={theme as CSSProperties}>
      <div className="relative left-1/2 right-1/2 w-screen -mx-[50vw] -my-6 h-[calc(100dvh-var(--app-header-h,0px))] overflow-hidden px-0">
        <div className="grid h-full min-h-0 grid-rows-[auto,minmax(0,1fr)] gap-2 overflow-hidden px-3 pb-[max(6px,env(safe-area-inset-bottom))] pt-1 sm:px-4 sm:pt-2">
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px] 2xl:grid-cols-[minmax(0,1fr)_460px] lg:items-start">
        <div className="order-2 flex min-w-0 flex-col gap-2 lg:order-1">
          <div className="flex flex-wrap items-center gap-2 self-start">
            {canEdit ? (
              <Link
                href={`/meetings/${meeting.id}/edit`}
                className="dr-button-outline px-3 py-1.5 text-xs"
              >
                Edit meeting
              </Link>
            ) : null}
            <Link
              href="/dashboard"
              className="dr-button-outline px-3 py-1.5 text-xs"
            >
              Back to dashboard
            </Link>
          </div>
          {meeting.transcriptionProvider === "WHISPERREMOTE" || meeting.transcriptionProvider === "AUTOREMOTE" ? (
            <div className="inline-flex max-w-2xl items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-900 sm:text-sm">
              <span className="mt-0.5 text-base leading-none">AI</span>
              <span>
                {meeting.transcriptionProvider === "AUTOREMOTE" && autoRemoteAssignment
                  ? autoRemoteAssignment.assignedUserId === session.user.id
                    ? "You are assigned to process this meeting after the call with Auto Remote. Keep the Remote Worker page open once the meeting has ended."
                    : `This meeting will be transcribed after the call by ${autoRemoteAssignment.assignedUserEmail}. That participant must keep the Remote Worker page open once the meeting has ended.`
                  : "This meeting will be transcribed after the call by remote workers. The recording is processed once the meeting has ended."}
              </span>
            </div>
          ) : null}
        </div>
        <div className="order-1 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm lg:order-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Meeting
          </p>
          <h1 className="mt-1.5 text-lg font-semibold text-slate-900 sm:text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
            {displayTitle}
          </h1>
          {displayDescription ? (
            <p className="mt-1.5 text-sm leading-6 text-slate-600">{displayDescription}</p>
          ) : null}
          {meeting.aiAgents.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-700">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                AI participants
              </span>
              {meeting.aiAgents.map(({ agent }) => (
                <span
                  key={agent.id}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: agent.color || "#0f172a" }}
                  />
                  <span>{agent.name}</span>
                  <span className="text-slate-500">@{agent.username}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

        <MeetingDetailClient
          embedUrl={embedUrl}
          joinUrl={joinUrl}
          isActive={active}
          hasBaseUrl={Boolean(baseUrl)}
          statusLabel={statusLabel}
          languageLabel={languageLabel}
          transcriptionProvider={meeting.transcriptionProvider}
          providerLabel={providerLabel}
        startsLabel={
          meeting.scheduledStartAt
            ? formatDateTime(meeting.scheduledStartAt, meeting.timezone)
            : "Not scheduled"
        }
        expiresLabel={formatDateTime(meeting.expiresAt, meeting.timezone)}
        hostLabel={hostMember?.user.email ?? "-"}
        hostHref={hostMember?.userId ? `/users/${hostMember.userId}` : null}
        roomLabel={meeting.roomId}
        meetingId={meeting.id}
        canManage={canManage}
        canInvite={canInvite}
        liveTranscriptionEnabled={liveTranscriptionEnabled}
        postCallTranscriptEnabled={postCallTranscriptEnabled}
        initialRoundId={meeting.transcriptionRoundId ?? null}
      />

      <div className="max-h-[22dvh] overflow-auto lg:max-h-[10dvh]">
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
      </div>
        </div>
      </div>
    </div>
  );
}
