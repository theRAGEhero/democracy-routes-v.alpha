import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { LoginForm } from "@/app/login/LoginForm";

export default async function LoginPage() {
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
          Sign in
        </h1>
      </div>
      <p className="mt-1 text-sm text-slate-500">Use your email and password.</p>
      <div className="mt-6">
        <LoginForm />
      </div>
      <p className="mt-4 text-center text-xs text-slate-600">
        New here? <Link href="/register" className="font-semibold">Create an account</Link>
      </p>
    </div>
  );
}
