import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function AdminVoskEmbedPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return <p className="text-sm text-slate-500">Access denied.</p>;
  }

  const embedUrl = "/audio-admin/vosk/";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
            Vosk Admin
          </h1>
          <p className="text-sm text-slate-600">Embedded Vosk-modular interface.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin" className="dr-button-outline px-4 py-2 text-sm">
            Back to Admin
          </Link>
          <a href={embedUrl} target="_blank" rel="noreferrer" className="dr-button-outline px-4 py-2 text-sm">
            Open standalone
          </a>
        </div>
      </div>

      <div className="dr-card overflow-hidden p-0">
        <iframe
          title="Vosk Admin"
          src={embedUrl}
          className="h-[78vh] w-full border-0"
          sandbox="allow-same-origin allow-scripts allow-forms allow-downloads allow-modals allow-popups"
        />
      </div>
    </div>
  );
}
