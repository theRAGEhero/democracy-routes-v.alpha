import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { RegisterForm } from "@/app/register/RegisterForm";
import { prisma } from "@/lib/prisma";

export default async function RegisterPage({
  searchParams
}: {
  searchParams?: { code?: string };
}) {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect("/dashboard");
  }

  const settings =
    (await prisma.registrationSettings.findFirst()) ??
    (await prisma.registrationSettings.create({ data: {} }));

  return (
    <div className="dr-card mx-auto mt-16 w-full max-w-md p-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 overflow-hidden rounded-2xl border border-emerald-200/80 bg-white/80">
          <img
            src="/logo-120.png"
            alt="Democracy Routes logo"
            className="h-full w-full object-contain"
          />
        </div>
        <h1 className="text-xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          Create account
        </h1>
      </div>
      <p className="mt-1 text-sm text-slate-500">Join the platform with your email.</p>
      <div className="mt-6">
        <RegisterForm
          initialCode={searchParams?.code ?? ""}
          registrationOpen={settings.registrationOpen}
          requireCode={settings.requireCode}
        />
      </div>
    </div>
  );
}
