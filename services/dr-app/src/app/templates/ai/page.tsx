import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TemplateAiClient } from "@/app/templates/ai/TemplateAiClient";

export default async function TemplateAiPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-8 pt-4">
      <TemplateAiClient />
    </div>
  );
}
