import { NextResponse } from "next/server";

export function requireAnalyzeTablesKey(request: Request) {
  const expected = process.env.ANALYZE_TABLES_API_KEY;
  if (!expected) {
    return null;
  }
  const provided = request.headers.get("x-api-key");
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
