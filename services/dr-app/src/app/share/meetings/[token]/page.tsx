import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isMeetingActive } from "@/lib/utils";
import { normalizeCallBaseUrl } from "@/lib/callUrl";
import { buildVideoAccessToken } from "@/lib/videoAccess";
import { GuestJoinCard } from "@/app/guest/meetings/[token]/GuestJoinCard";
import { getRoomProviderSuffix } from "@/lib/transcriptionProviders";

export default async function SharedMeetingPage({
  params
}: {
  params: { token: string };
}) {
  const shareLink = await prisma.meetingShareLink.findUnique({
    where: { token: params.token },
    include: {
      meeting: {
        include: {
          members: true
        }
      }
    }
  });

  if (!shareLink) {
    return (
      <div className="dr-card mx-auto mt-16 w-full max-w-lg p-6">
        <h1 className="text-xl font-semibold text-slate-900">Share link not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          This meeting link is invalid or expired.
        </p>
        <Link href="/login" className="mt-4 inline-flex text-sm font-semibold text-slate-700 hover:underline">
          Go to login
        </Link>
      </div>
    );
  }

  if (shareLink.expiresAt && shareLink.expiresAt.getTime() < Date.now()) {
    return (
      <div className="dr-card mx-auto mt-16 w-full max-w-lg p-6">
        <h1 className="text-xl font-semibold text-slate-900">Share link expired</h1>
        <p className="mt-2 text-sm text-slate-600">
          This meeting link is no longer valid.
        </p>
      </div>
    );
  }

  const meeting = shareLink.meeting;
  const session = await getServerSession(authOptions);

  if (session?.user) {
    const existingMember = meeting.members.find((member) => member.userId === session.user.id);
    if (!existingMember) {
      if (isMeetingActive(meeting)) {
        const approvedCount = await prisma.meetingMember.count({
          where: { meetingId: meeting.id }
        });

        if (meeting.capacity && approvedCount >= meeting.capacity) {
          return (
            <div className="dr-card mx-auto mt-16 w-full max-w-lg p-6">
              <h1 className="text-xl font-semibold text-slate-900">Meeting full</h1>
              <p className="mt-2 text-sm text-slate-600">
                This shared meeting has reached its capacity.
              </p>
            </div>
          );
        }
      }

      await prisma.meetingMember.create({
        data: {
          meetingId: meeting.id,
          userId: session.user.id,
          role: "GUEST"
        }
      });
    }

    redirect(`/meetings/${meeting.id}`);
  }

  const active = isMeetingActive(meeting);
  const baseUrl = normalizeCallBaseUrl(process.env.DEMOCRACYROUTES_CALL_BASE_URL || "");
  const langCode = meeting.language === "IT" ? "it" : "en";
  const providerCode = getRoomProviderSuffix(meeting.transcriptionProvider).toLowerCase();
  const accessToken = buildVideoAccessToken({
    roomId: meeting.roomId,
    meetingId: meeting.id
  });

  return (
    <div className="mx-auto mt-10 max-w-2xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Shared meeting
        </p>
        <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          {meeting.title}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Join this meeting without registration, or sign in first and the app will treat you as a registered participant.
        </p>
      </div>

      <GuestJoinCard
        active={active}
        baseUrl={baseUrl}
        roomId={meeting.roomId}
        meetingId={meeting.id}
        language={langCode}
        provider={providerCode}
        defaultDisplayName="Guest"
        accessToken={accessToken}
      />

      <p className="text-xs text-slate-500">
        Already have an account? <Link href={`/login?callbackUrl=${encodeURIComponent(`/share/meetings/${params.token}`)}`} className="font-semibold text-slate-700 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
