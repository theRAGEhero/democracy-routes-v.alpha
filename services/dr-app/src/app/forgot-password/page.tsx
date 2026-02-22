import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { ForgotPasswordForm } from "@/app/forgot-password/ForgotPasswordForm";

export default async function ForgotPasswordPage() {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect("/dashboard");
  }

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
          Reset password
        </h1>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Enter your email and we&apos;ll send you a reset link.
      </p>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
      <p className="mt-4 text-center text-xs text-slate-600">
        Remembered it? <Link href="/login" className="font-semibold">Sign in</Link>
      </p>
    </div>
  );
}
