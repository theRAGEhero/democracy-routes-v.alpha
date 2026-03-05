import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const publicPaths = ["/login", "/register", "/api/auth", "/api/register", "/guest"]; 

function isPublicPath(pathname: string) {
  return publicPaths.some((path) => pathname === path || pathname.startsWith(path));
}

function createRequestId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function logAccess(message: string, meta: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    level: "info",
    message,
    ...meta
  };
  console.log(JSON.stringify(payload));
}

function withRequestId(request: NextRequest, requestId: string) {
  const headers = new Headers(request.headers);
  headers.set("x-request-id", requestId);
  const response = NextResponse.next({
    request: { headers }
  });
  response.headers.set("x-request-id", requestId);
  return response;
}

function withRedirectAndRequestId(url: URL, requestId: string) {
  const response = NextResponse.redirect(url);
  response.headers.set("x-request-id", requestId);
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = request.headers.get("x-request-id") || createRequestId();
  if (pathname.startsWith("/api/")) {
    logAccess("api_request_in", {
      requestId,
      method: request.method,
      path: pathname
    });
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/assets")
  ) {
    return withRequestId(request, requestId);
  }

  if (isPublicPath(pathname)) {
    return withRequestId(request, requestId);
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return withRedirectAndRequestId(loginUrl, requestId);
  }

  if (
    token.mustChangePassword &&
    !pathname.startsWith("/account/change-password") &&
    !pathname.startsWith("/api/account/change-password")
  ) {
    const changeUrl = new URL("/account/change-password", request.url);
    return withRedirectAndRequestId(changeUrl, requestId);
  }

  return withRequestId(request, requestId);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
