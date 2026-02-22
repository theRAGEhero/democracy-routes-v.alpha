import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { ChangePasswordForm } from "@/app/account/change-password/ChangePasswordForm";

export default async function ChangePasswordPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  if (!session.user.mustChangePassword) {
    redirect("/dashboard");
  }

  return (
    <div className="dr-card mx-auto mt-16 w-full max-w-md p-6">
      <h1 className="text-xl font-semibold text-slate-900">Change password</h1>
      <p className="mt-1 text-sm text-slate-500">
        You must update your password before continuing.
      </p>
      <div className="mt-6">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
