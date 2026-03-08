import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { RemoteWorkerPageClient } from "./RemoteWorkerPageClient";

export default async function RemoteWorkerPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return <p className="text-sm text-slate-500">Access denied.</p>;
  }

  return <RemoteWorkerPageClient />;
}
