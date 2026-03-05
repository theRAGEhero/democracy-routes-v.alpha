"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  dataspaceId: string;
  dataspaceName: string;
};

type ApiError = { error?: string | { message?: string } };

function getErrorMessage(payload: ApiError, fallback: string) {
  if (typeof payload?.error === "string") return payload.error;
  if (payload?.error && typeof payload.error === "object") {
    return payload.error.message || fallback;
  }
  return fallback;
}

export function CallLanding({ dataspaceId, dataspaceName }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          language: "EN",
          transcriptionProvider: "DEEPGRAMLIVE",
          dataspaceId
        })
      });
      const payload = (await response.json().catch(() => ({}))) as { id?: string } & ApiError;
      if (!response.ok || !payload?.id) {
        setError(getErrorMessage(payload, "Unable to create the call. Please try again."));
        return;
      }
      router.push(`/meetings/${payload.id}`);
    } catch (err) {
      setError("Unable to create the call. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-3xl">
      <div className="mb-6">
        <h1
          className="text-3xl font-semibold text-slate-900"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Create a call
        </h1>
        <p className="text-sm text-slate-600">
          Start a live conversation in the <span className="font-semibold">{dataspaceName}</span>{" "}
          dataspace.
        </p>
      </div>
      <form className="dr-card p-6 sm:p-8 space-y-6" onSubmit={handleSubmit}>
        <div>
          <label className="text-sm font-medium text-slate-700" htmlFor="call-title">
            Call title (optional)
          </label>
          <input
            id="call-title"
            className="dr-input mt-2 w-full rounded-xl px-4 py-3 text-base"
            placeholder="Inclusive Commons, Civic Roundtable, etc."
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500">
            This creates an instant meeting with live transcription enabled.
          </div>
          <button
            type="submit"
            className="dr-button px-6 py-3 text-sm font-semibold shadow-sm"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Create call"}
          </button>
        </div>
      </form>
    </div>
  );
}
