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
    <div className="w-full">
      <div className="mx-auto w-full max-w-6xl space-y-4 px-2 sm:px-4 lg:px-5 xl:px-6">
        <div className="text-center sm:text-left">
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-[2rem]" style={{ fontFamily: "var(--font-serif)" }}>
            New meeting
          </h1>
          <p className="mt-1 text-sm text-slate-500">Create a new call room link.</p>
        </div>
        <div className="dr-card p-4 sm:p-5 lg:p-6">
          <NewMeetingForm dataspaces={dataspaces} />
        </div>
      </div>
    </div>
  );
}
