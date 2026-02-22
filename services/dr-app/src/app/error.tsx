"use client";

import { useEffect } from "react";
import { logError } from "@/lib/logger";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError("App router error boundary", error, { digest: error.digest });
  }, [error]);

  return (
    <div className="mx-auto mt-16 max-w-lg rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-700">
      <h2 className="text-lg font-semibold text-slate-900">Something went wrong</h2>
      <p className="mt-2">Check the console for details.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
      >
        Try again
      </button>
    </div>
  );
}
