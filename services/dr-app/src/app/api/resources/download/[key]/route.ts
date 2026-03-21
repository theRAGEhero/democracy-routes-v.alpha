import { NextResponse } from "next/server";
import {
  incrementResourceDownloadCount,
  RESOURCE_DOWNLOADS,
  type ResourceDownloadKey
} from "@/lib/resourceDownloadCounters";

type RouteContext = {
  params: {
    key: string;
  };
};

export async function GET(request: Request, { params }: RouteContext) {
  const key = params.key as ResourceDownloadKey;
  const resource = RESOURCE_DOWNLOADS[key];
  if (!resource) {
    return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
  }

  await incrementResourceDownloadCount(key);
  return new NextResponse(null, {
    status: 307,
    headers: {
      Location: resource.publicPath
    }
  });
}
