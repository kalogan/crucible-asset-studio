import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Basic-auth gate for the Vercel deployment (single-user remote access). Enforced
 * ONLY on Vercel (process.env.VERCEL set) — local dev / `next start` stay open.
 * Fails CLOSED in prod: if CRUCIBLE_ACCESS_PASSWORD is unset, the site is blocked
 * rather than accidentally public.
 */
/**
 * Forward the project slug from `/projects/[slug]/...` as a request header so server
 * code (getActiveProject) resolves the workspace's project from the URL — making the
 * URL the source of truth for the nested workspace, not just the active-project cookie.
 */
function pass(req: NextRequest): NextResponse {
  const m = req.nextUrl.pathname.match(/^\/projects\/([^/]+)/);
  if (!m) return NextResponse.next();
  const headers = new Headers(req.headers);
  headers.set("x-active-project-slug", decodeURIComponent(m[1] as string));
  return NextResponse.next({ request: { headers } });
}

export function middleware(req: NextRequest): NextResponse {
  if (!process.env.VERCEL) return pass(req);

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
    const passwd = decoded.slice(sep + 1);
    const expectedUser = process.env.CRUCIBLE_ACCESS_USER ?? "crucible";
    if (passwd === password && user === expectedUser) {
      return pass(req);
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Crucible", charset="UTF-8"' },
  });
}

export const config = {
  // /api/import + /api/project-screenshot have their own bearer-token auth
  // (machine-to-machine push) — exclude them from the interactive Basic-auth gate.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/import|api/project-screenshot).*)"],
};
