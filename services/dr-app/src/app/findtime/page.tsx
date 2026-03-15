import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { FindTimeClient } from "@/app/findtime/FindTimeClient";

export default async function FindTimePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="relative left-1/2 right-1/2 w-screen -mx-[50vw] overflow-hidden px-0">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <span className="absolute -top-16 right-[14%] h-60 w-60 rounded-full bg-amber-400/25 blur-xl" />
        <span className="absolute bottom-[10%] left-[6%] h-60 w-60 rounded-full bg-emerald-400/20 blur-xl" />
        <span className="absolute -bottom-20 right-[-40px] h-60 w-60 rounded-full bg-sky-400/20 blur-xl" />
      </div>
      <div className="mx-auto w-full max-w-[980px] px-3 py-6 sm:px-5">
        <div className="mb-7 flex items-center justify-between gap-4 rounded-full border border-[color:var(--stroke)] bg-white/75 px-5 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur">
          <div className="flex items-center gap-3 text-[color:var(--accent-deep)]">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--stroke)] bg-white font-bold">
              T
            </span>
            <span className="text-lg font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
              Time
            </span>
          </div>
          <div className="hidden items-center gap-3 text-sm text-slate-500 sm:flex">
            <span>Availability studio</span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-800">
              Multi-user
            </span>
          </div>
        </div>
        <FindTimeClient />
      </div>
    </div>
  );
}
