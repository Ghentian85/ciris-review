import type { NextRequest } from "next/server";
import { env } from "@/lib/env";

// Tenant-aware base URL for things like magic-link callbacks. Looks at
// X-Forwarded-Host / Host (set by Vercel's edge) so a request that hit
// studio360.ciris.studio produces a magic link back to studio360.
// Falls back to env.APP_URL in weird environments (CLI, tests, a
// request that somehow has no host).
//
// Only trusts hosts in ALLOWED_HOSTS so a crafted Host header can't
// turn our magic links into a phishing primitive.

const ALLOWED_HOSTS = new Set<string>([
  "review.ciris.studio",
  "studio360.ciris.studio",
  // Local dev — any port on localhost is fine.
]);

function hostIsAllowed(host: string): boolean {
  if (!host) return false;
  if (ALLOWED_HOSTS.has(host)) return true;
  // Allow localhost / 127.0.0.1 on any port for dev.
  if (/^localhost(:\d+)?$/.test(host)) return true;
  if (/^127\.0\.0\.1(:\d+)?$/.test(host)) return true;
  return false;
}

export function getRequestBaseUrl(req: NextRequest): string {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = (forwardedHost || req.headers.get("host") || "")
    .toLowerCase()
    .split(",")[0]
    ?.trim();
  if (host && hostIsAllowed(host)) {
    // Protocol: localhost gets http, everything else is forced to https.
    // Trusting x-forwarded-proto bit us — the request that mints the
    // magic link sometimes arrives through an upstream that forwards
    // "http", and the resulting Secure cookie is dropped by the browser
    // after the verify redirect, kicking the user back to sign-in.
    const isLocal =
      host.startsWith("localhost") || host.startsWith("127.0.0.1");
    const proto = isLocal ? "http" : "https";
    return `${proto}://${host}`;
  }
  return env.APP_URL;
}
