import type { NextRequest, NextResponse } from "next/server";
import { adminCookieName, currentAdmin } from "@/lib/admin-auth";
import { isSameOrigin, jsonError } from "@/lib/http";

export function requireAdmin(request: NextRequest, mutating: boolean): { error: NextResponse } | { admin: string } {
  const admin = currentAdmin(request.cookies.get(adminCookieName)?.value);
  if (!admin) return { error: jsonError("Sign in as an admin first.", 401) };
  if (mutating && !isSameOrigin(request)) return { error: jsonError("Admin changes must come from this site.", 403) };
  return { admin };
}
