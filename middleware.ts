import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Basic-auth gate for the Vercel deployment (single-user remote access). Enforced
 * ONLY on Vercel (process.env.VERCEL set) — local dev / `next start` stay open.
 * Fails CLOSED in prod: if CRUCIBLE_ACCESS_PASSWORD is unset, the site is blocked
 * rather than accidentally public.
 */
export function middleware(req: NextRequest): NextResponse {
  if (!process.env.VERCEL) return NextResponse.next();

  const password = process.env.CRUCIBLE_ACCESS_PASSWORD;
  if (!password) {
    return new NextResponse("Access not configured — set CRUCIBLE_ACCESS_PASSWORD.", {
      status: 503,
    });
  }

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const sep = decoded.indexOf(":");
    const user = decoded.slice(0, sep);
    const pass = decoded.slice(sep + 1);
    const expectedUser = process.env.CRUCIBLE_ACCESS_USER ?? "crucible";
    if (pass === password && user === expectedUser) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Crucible", charset="UTF-8"' },
  });
}

export const config = {
  // /api/import has its own bearer-token auth (machine-to-machine push) — exclude it
  // from the interactive Basic-auth gate.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/import).*)"],
};
