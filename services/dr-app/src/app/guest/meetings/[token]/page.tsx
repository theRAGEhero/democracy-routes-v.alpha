import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isMeetingActive } from "@/lib/utils";
import { normalizeCallBaseUrl } from "@/lib/callUrl";
import { buildVideoAccessToken } from "@/lib/videoAccess";
import { GuestJoinCard } from "@/app/guest/meetings/[token]/GuestJoinCard";

export default async function GuestMeetingPage({
  params
}: {
  params: { token: string };
}) {
  const invite = await prisma.meetingGuestInvite.findUnique({
    where: { token: params.token },
    include: {
      meeting: true
    }
  });

  if (!invite) {
    return (
      <div className="dr-card mx-auto mt-16 w-full max-w-lg p-6">
        <h1 className="text-xl font-semibold text-slate-900">Invite not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          This invite link is invalid or expired.
        </p>
        <Link href="/login" className="mt-4 inline-flex text-sm font-semibold text-slate-700 hover:underline">
          Go to login
        </Link>
      </div>
    );
  }

  const meeting = invite.meeting;
  const active = isMeetingActive(meeting);
  const baseUrl = normalizeCallBaseUrl(process.env.DEMOCRACYROUTES_CALL_BASE_URL || "");
  const langCode = meeting.language === "IT" ? "it" : "en";
  const providerCode =
    meeting.transcriptionProvider === "VOSK"
      ? "vosk"
      : meeting.transcriptionProvider === "AUTOREMOTE"
        ? "autoremote"
      : meeting.transcriptionProvider === "WHISPERREMOTE"
        ? "whisperremote"
      : meeting.transcriptionProvider === "DEEPGRAMLIVE"
        ? "deepgramlive"
        : "deepgram";
  const accessToken = buildVideoAccessToken({
    roomId: meeting.roomId,
    meetingId: meeting.id,
    userEmail: invite.email
  });

  return (
    <div className="mx-auto mt-10 max-w-2xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Guest invite
        </p>
        <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          {meeting.title}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          You are invited as <span className="font-semibold">{invite.email}</span>.
        </p>
        {meeting.transcriptionProvider === "WHISPERREMOTE" || meeting.transcriptionProvider === "AUTOREMOTE" ? (
          <div className="mt-3 inline-flex max-w-2xl items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-900">
            <span className="mt-0.5 text-base leading-none">AI</span>
            <span>
              This meeting will be transcribed after the call by remote workers. The
              recording is processed once the meeting has ended.
            </span>
          </div>
        ) : null}
      </div>

      <GuestJoinCard
        active={active}
        baseUrl={baseUrl}
        roomId={meeting.roomId}
        meetingId={meeting.id}
        language={langCode}
        provider={providerCode}
        inviteEmail={invite.email}
        accessToken={accessToken}
      />

      <p className="text-xs text-slate-500">
        Prefer to register? <Link href="/register" className="font-semibold text-slate-700 hover:underline">Create an account</Link>
      </p>
    </div>
  );
}
