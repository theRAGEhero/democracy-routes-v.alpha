import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim() ?? "";
  const exclude = url.searchParams.get("exclude")?.trim() ?? "";

  if (!query) {
    return NextResponse.json({ users: [] });
  }

  const excludeSet = new Set(
    exclude
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );

  const users = await prisma.user.findMany({
    where: {
      email: { contains: query },
      isDeleted: false
    },
    orderBy: { email: "asc" },
    take: 8,
    select: { id: true, email: true }
  });

  const filtered = excludeSet.size
    ? users.filter(
        (user: (typeof users)[number]) =>
          !excludeSet.has(user.email.toLowerCase())
      )
    : users;

  return NextResponse.json({ users: filtered });
}
