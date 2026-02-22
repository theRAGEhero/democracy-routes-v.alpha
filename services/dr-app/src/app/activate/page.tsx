import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ActivatePage({
  searchParams
}: {
  searchParams?: { token?: string };
}) {
  const token = searchParams?.token?.trim();
  if (!token) {
    return (
      <div className="dr-card mx-auto mt-16 w-full max-w-md p-6">
        <h1 className="text-xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          Activation link missing
        </h1>
        <p className="mt-2 text-sm text-slate-600">Please use the activation link from your email.</p>
        <Link href="/login" className="mt-4 inline-flex text-sm font-semibold text-slate-900 hover:underline">
          Back to login
        </Link>
      </div>
    );
  }

  const user = await prisma.user.findFirst({
    where: { emailVerificationToken: token }
  });

  if (!user) {
    return (
      <div className="dr-card mx-auto mt-16 w-full max-w-md p-6">
        <h1 className="text-xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          Invalid activation link
        </h1>
        <p className="mt-2 text-sm text-slate-600">The activation token is not valid.</p>
        <Link href="/login" className="mt-4 inline-flex text-sm font-semibold text-slate-900 hover:underline">
          Back to login
        </Link>
      </div>
    );
  }

  if (user.emailVerifiedAt) {
    return (
      <div className="dr-card mx-auto mt-16 w-full max-w-md p-6">
        <h1 className="text-xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          Account already activated
        </h1>
        <p className="mt-2 text-sm text-slate-600">You can sign in now.</p>
        <Link href="/login" className="mt-4 inline-flex text-sm font-semibold text-slate-900 hover:underline">
          Go to login
        </Link>
      </div>
    );
  }

  if (user.emailVerificationExpiresAt && user.emailVerificationExpiresAt < new Date()) {
    return (
      <div className="dr-card mx-auto mt-16 w-full max-w-md p-6">
        <h1 className="text-xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          Activation link expired
        </h1>
        <p className="mt-2 text-sm text-slate-600">Please request a new activation email.</p>
        <Link href="/login" className="mt-4 inline-flex text-sm font-semibold text-slate-900 hover:underline">
          Back to login
        </Link>
      </div>
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      emailVerificationToken: null,
      emailVerificationExpiresAt: null
    }
  });

  return (
    <div className="dr-card mx-auto mt-16 w-full max-w-md p-6">
      <h1 className="text-xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
        Account activated
      </h1>
      <p className="mt-2 text-sm text-slate-600">Your email has been confirmed.</p>
      <Link href="/login" className="mt-4 inline-flex text-sm font-semibold text-slate-900 hover:underline">
        Continue to login
      </Link>
    </div>
  );
}
