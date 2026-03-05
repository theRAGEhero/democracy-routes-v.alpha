"use client";

import { useState } from "react";

type Props = {
  dataspaceId: string;
  isSubscribed: boolean;
  initialNotifyAll: boolean;
  initialNotifyMeetings: boolean;
  initialNotifyPlans: boolean;
  initialNotifyTexts: boolean;
};

export function DataspaceNotificationPreferences({
  dataspaceId,
  isSubscribed,
  initialNotifyAll,
  initialNotifyMeetings,
  initialNotifyPlans,
  initialNotifyTexts
}: Props) {
  const [notifyAll, setNotifyAll] = useState(initialNotifyAll);
  const [notifyMeetings, setNotifyMeetings] = useState(initialNotifyMeetings);
  const [notifyPlans, setNotifyPlans] = useState(initialNotifyPlans);
  const [notifyTexts, setNotifyTexts] = useState(initialNotifyTexts);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    if (!isSubscribed) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    const response = await fetch(`/api/dataspaces/${dataspaceId}/preferences`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notifyAllActivity: notifyAll,
        notifyMeetings,
        notifyPlans,
        notifyTexts
      })
    });

    const payload = await response.json().catch(() => null);
    setSaving(false);

    if (!response.ok) {
      const message = payload?.error?.formErrors?.[0] ?? payload?.error ?? "Unable to save preferences";
      setError(message);
      return;
    }

    setSuccess(true);
  }

  return (
    <div className="dr-card p-6">
      <h2 className="text-sm font-semibold uppercase text-slate-500">Your notifications</h2>
      {!isSubscribed ? (
        <p className="mt-2 text-sm text-slate-600">
          Subscribe to notifications to manage your personal preferences.
        </p>
      ) : (
        <div className="mt-3 space-y-3 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={notifyAll}
              onChange={(event) => setNotifyAll(event.target.checked)}
              className="h-4 w-4"
            />
            <span>Notify me on all dataspace activity</span>
          </label>
          <div className="grid gap-2 pl-6 text-xs text-slate-600">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={notifyMeetings}
                onChange={(event) => setNotifyMeetings(event.target.checked)}
                className="h-3 w-3"
              />
              <span>Meetings created</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={notifyPlans}
                onChange={(event) => setNotifyPlans(event.target.checked)}
                className="h-3 w-3"
              />
              <span>Templates created</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={notifyTexts}
                onChange={(event) => setNotifyTexts(event.target.checked)}
                className="h-3 w-3"
              />
              <span>Text notes imported</span>
            </label>
          </div>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          {success ? <p className="text-xs text-emerald-700">Saved.</p> : null}
          <button
            type="button"
            onClick={handleSave}
            className="dr-button-outline px-3 py-2 text-xs"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save preferences"}
          </button>
        </div>
      )}
    </div>
  );
}
