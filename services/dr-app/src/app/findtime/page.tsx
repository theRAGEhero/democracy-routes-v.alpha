import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { FindTimeClient } from "@/app/findtime/FindTimeClient";

export default async function FindTimePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-3 py-6 sm:px-4 lg:px-6">
      <FindTimeClient />
    </div>
  );
}
