import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { ResetPasswordForm } from "@/app/reset-password/ResetPasswordForm";

type ResetPasswordPageProps = {
  searchParams?: { token?: string };
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect("/dashboard");
  }

  const token = searchParams?.token ?? null;

  return (
    <div className="dr-card mx-auto mt-20 w-full max-w-md p-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 overflow-hidden rounded-2xl border border-emerald-200/80 bg-white/80">
          <img
            src="/logo-120.png"
            alt="Democracy Routes logo"
            className="h-full w-full object-contain"
          />
        </div>
        <h1 className="text-xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          Set a new password
        </h1>
      </div>
      <p className="mt-1 text-sm text-slate-500">Choose a strong new password.</p>
      <div className="mt-6">
        <ResetPasswordForm token={token} />
      </div>
      <p className="mt-4 text-center text-xs text-slate-600">
        Back to <Link href="/login" className="font-semibold">sign in</Link>
      </p>
    </div>
  );
}
