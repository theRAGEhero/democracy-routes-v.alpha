import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkRateLimit, getRequestIp } from "@/lib/rateLimit";

const handler = NextAuth(authOptions);

export { handler as GET };

function getNextAuthParams(request: Request) {
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const authIndex = segments.indexOf("auth");
  if (authIndex === -1) {
    return { params: { nextauth: [] as string[] } };
  }
  return { params: { nextauth: segments.slice(authIndex + 1) } };
}

export async function POST(request: Request) {
  const ip = getRequestIp(request);
  const rate = checkRateLimit({
    key: `login:${ip}`,
    limit: 12,
    windowMs: 10 * 60 * 1000
  });
  if (!rate.ok) {
    return new Response(
      JSON.stringify({ error: "Too many login attempts. Please try again later." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rate.retryAfterSeconds)
        }
      }
    );
  }

  return handler(request, getNextAuthParams(request));
}
