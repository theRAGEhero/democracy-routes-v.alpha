import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  DEFAULT_TEMPLATE_MODULE_DESCRIPTIONS,
  getTemplateModuleDescriptions
} from "@/lib/templateModuleDescriptions";
import {
  DEFAULT_TEMPLATE_AI_INSTRUCTIONS,
  getTemplateAiInstructions
} from "@/lib/templateAiInstructions";
import { TemplateModuleDescriptionsClient } from "./TemplateModuleDescriptionsClient";

export default async function TemplateModuleDescriptionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/templates/workspace?mode=modular");
  }

  const descriptions = await getTemplateModuleDescriptions();
  const instructions = await getTemplateAiInstructions();

  return (
    <TemplateModuleDescriptionsClient
      initialDescriptions={descriptions}
      defaults={DEFAULT_TEMPLATE_MODULE_DESCRIPTIONS}
      initialInstructions={instructions}
      instructionDefaults={DEFAULT_TEMPLATE_AI_INSTRUCTIONS}
    />
  );
}
