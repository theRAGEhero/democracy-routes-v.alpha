"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  initialCode: string;
  registrationOpen: boolean;
  requireCode: boolean;
};

export function RegisterForm({ initialCode, registrationOpen, requireCode }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState(initialCode);
  const [acceptPolicy, setAcceptPolicy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCode(initialCode);
  }, [initialCode]);

  function getFieldErrorMap(payload: any): Record<string, string> {
    const next: Record<string, string> = {};
    const fieldErrors = payload?.error?.fieldErrors;
    if (!fieldErrors || typeof fieldErrors !== "object") return next;
    Object.entries(fieldErrors).forEach(([key, value]) => {
      if (Array.isArray(value) && typeof value[0] === "string") {
        next[key] = value[0];
      }
    });
    return next;
  }

  function getErrorMessage(payload: any): string {
    if (!payload) return "Unable to register";
    const formError = payload?.error?.formErrors?.[0];
    if (typeof formError === "string" && formError.length > 0) return formError;
    const fieldErrors = payload?.error?.fieldErrors;
    if (fieldErrors && typeof fieldErrors === "object") {
      const firstKey = Object.keys(fieldErrors)[0];
      const firstField = firstKey ? fieldErrors[firstKey]?.[0] : null;
      if (typeof firstField === "string" && firstField.length > 0) return firstField;
    }
    if (typeof payload?.error === "string") return payload.error;
    return "Unable to register";
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSuccess(null);
    setLoading(true);

    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, confirmPassword, code, acceptPolicy })
    });

    let data: any = null;
    try {
      data = await response.json();
    } catch (jsonError) {
      data = null;
    }
    if (!response.ok) {
      setFieldErrors(getFieldErrorMap(data));
      setError(getErrorMessage(data));
      setLoading(false);
      return;
    }

    if (data?.verificationRequired) {
      setSuccess(
        data?.emailSent
          ? "Account created. Check your email to activate your account."
          : "Account created, but confirmation email was not sent. Contact support."
      );
      setLoading(false);
      return;
    }

    await signIn("credentials", {
      redirect: false,
      email,
      password
    });

    setLoading(false);
    router.push("/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!registrationOpen ? (
        <p className="text-sm text-amber-700">
          Registration is currently closed.
        </p>
      ) : null}
      <div>
        <label className="text-sm font-medium">Email</label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          required
        />
        {fieldErrors.email ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
        ) : null}
      </div>
      <div>
        <label className="text-sm font-medium">Password</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          required
        />
        {fieldErrors.password ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
        ) : null}
        <p className="mt-1 text-xs text-slate-500">Minimum 12 characters, 1 letter, 1 number.</p>
      </div>
      <div>
        <label className="text-sm font-medium">Confirm password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          required
        />
        {fieldErrors.confirmPassword ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.confirmPassword}</p>
        ) : null}
      </div>
      {requireCode ? (
        <div>
          <label className="text-sm font-medium">Registration code</label>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
            required
          />
          {fieldErrors.code ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.code}</p>
          ) : null}
        </div>
      ) : code ? (
        <div>
          <label className="text-sm font-medium">Registration code (optional)</label>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          />
          {fieldErrors.code ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.code}</p>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
      <div className="rounded-lg border border-slate-200 bg-white/80 p-4 text-xs text-slate-600">
        <p className="text-sm font-semibold text-slate-900">Privacy policy summary</p>
        <p className="mt-1 text-xs text-slate-600">
          This platform is an MVP in beta mode. It provides meeting links, plan schedules, and
          transcription services. By creating an account, you allow us to store your email, access
          preferences, and participation data needed to run calls, invitations, and plan activities.
        </p>
        <p className="mt-2 text-xs text-slate-600">
          We store:
        </p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-600">
          <li>Account data (email, password hash, role, settings).</li>
          <li>Meeting and plan participation, invites, and room assignments.</li>
          <li>Transcriptions and notes when enabled by a host.</li>
        </ul>
        <p className="mt-2 text-xs text-slate-600">
          You can request data deletion by contacting an administrator.
        </p>
        <label className="mt-3 flex items-start gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={acceptPolicy}
            onChange={(event) => setAcceptPolicy(event.target.checked)}
            className="mt-0.5 h-4 w-4"
            required
          />
          <span>
            I have read and accept the{" "}
            <Link href="/privacy" className="font-semibold underline">
              privacy policy
            </Link>{" "}
            and{" "}
            <Link href="/cookies" className="font-semibold underline">
              cookie policy
            </Link>.
          </span>
        </label>
        {fieldErrors.acceptPolicy ? (
          <p className="mt-2 text-xs text-red-600">{fieldErrors.acceptPolicy}</p>
        ) : null}
      </div>
      <button
        type="submit"
        className="dr-button w-full px-4 py-2 text-sm"
        disabled={loading || !registrationOpen || !acceptPolicy}
      >
        {loading ? "Creating..." : "Create account"}
      </button>
      <p className="text-center text-xs text-slate-600">
        Already have an account? <Link href="/login" className="font-semibold">Sign in</Link>
      </p>
    </form>
  );
}
