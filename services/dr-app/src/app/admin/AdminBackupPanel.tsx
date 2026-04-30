"use client";

import { useEffect, useState } from "react";

type BackupItem = {
  name: string;
  size: number;
  updatedAt: string;
  checksumExists: boolean;
  downloadUrl: string;
  checksumUrl: string | null;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(1)} ${units[index]}`;
}

export function AdminBackupPanel() {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const backupDir = "/backups";

  async function loadBackups() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/backups");
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Unable to load backups.");
      } else {
        setBackups(payload?.backups ?? []);
      }
    } catch {
      setError("Unable to load backups.");
    } finally {
      setLoading(false);
    }
  }

  async function runBackup() {
    if (running) return;
    setRunning(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/backups", { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.detail || payload?.error || "Backup failed.");
      } else {
        setMessage(payload?.stdout || "Backup completed.");
        await loadBackups();
      }
    } catch {
      setError("Backup failed.");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    loadBackups();
  }, []);

  return (
    <div className="dr-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Backups</h2>
          <p className="text-sm text-slate-600">Create and download full stack backups.</p>
        </div>
        <button
          type="button"
          onClick={runBackup}
          className="dr-button px-4 py-2 text-sm"
          disabled={running}
        >
          {running ? "Running..." : "Run backup"}
        </button>
      </div>

      {message ? <p className="mt-3 text-sm text-emerald-600">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-4 rounded-xl border border-slate-200 bg-white/70 p-4 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Current backup directory</p>
        <p className="mt-1 font-mono text-xs text-slate-600">{backupDir}</p>
        <p className="mt-2 text-xs text-slate-500">
          Restore is manual. Use{" "}
          <span className="font-mono">/root/Democracy Routes/scripts/backup/restore.sh</span>{" "}
          with the downloaded archive.
        </p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[680px]">
          <div className="grid grid-cols-12 gap-3 border-b border-slate-200 px-2 py-2 text-xs font-semibold uppercase text-slate-500">
            <span className="col-span-5">File</span>
            <span className="col-span-2">Size</span>
            <span className="col-span-3">Updated</span>
            <span className="col-span-2">Download</span>
          </div>
          {loading ? (
            <div className="px-2 py-4 text-sm text-slate-500">Loading backups...</div>
          ) : backups.length === 0 ? (
            <div className="px-2 py-4 text-sm text-slate-500">No backups yet.</div>
          ) : (
            backups.map((backup) => (
              <div
                key={backup.name}
                className="grid grid-cols-12 gap-3 border-b border-slate-100 px-2 py-3 text-sm text-slate-700"
              >
                <span className="col-span-5 font-medium">{backup.name}</span>
                <span className="col-span-2">{formatBytes(backup.size)}</span>
                <span className="col-span-3 text-slate-500">
                  {new Date(backup.updatedAt).toLocaleString()}
                </span>
                <span className="col-span-2 flex flex-wrap gap-2">
                  <a
                    className="text-xs font-semibold text-slate-700 hover:underline"
                    href={backup.downloadUrl}
                  >
                    Archive
                  </a>
                  {backup.checksumUrl ? (
                    <a
                      className="text-xs font-semibold text-slate-500 hover:underline"
                      href={backup.checksumUrl}
                    >
                      SHA256
                    </a>
                  ) : null}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
