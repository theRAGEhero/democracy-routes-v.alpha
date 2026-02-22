import { NewMeetingForm } from "@/app/meetings/new/NewMeetingForm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NewMeetingPage() {
  const session = await getServerSession(authOptions);
  const dataspaces = session?.user
    ? await prisma.dataspace.findMany({
        where: { members: { some: { userId: session.user.id } } },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true }
      })
    : [];

  return (
    <div className="w-full max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          New meeting
        </h1>
        <p className="text-sm text-slate-500">Create a new call room link.</p>
      </div>
      <div className="dr-card p-4 sm:p-6">
        <NewMeetingForm dataspaces={dataspaces} />
      </div>
    </div>
  );
}
