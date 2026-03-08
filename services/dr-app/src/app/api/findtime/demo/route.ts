import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildFindTimeDemo, scoreFindTimeRequest } from "@/lib/findtime";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const demo = buildFindTimeDemo();

  return NextResponse.json({
    ...demo,
    initialMatch: scoreFindTimeRequest(demo)
  });
}
