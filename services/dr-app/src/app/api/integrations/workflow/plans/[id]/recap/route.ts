import { NextResponse } from "next/server";
import { requireWorkflowKey } from "@/app/api/integrations/workflow/utils";
import { getPlanRecapDataForWorkflow, isPlanRecapError } from "@/lib/planRecap";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authError = requireWorkflowKey(request);
  if (authError) return authError;

  try {
    const recap = await getPlanRecapDataForWorkflow(params.id);
    return NextResponse.json(recap, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    if (isPlanRecapError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
