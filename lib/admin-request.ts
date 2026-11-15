import type { NextRequest, NextResponse } from "next/server";
import { adminConfig, adminCookieName, currentAdmin, isOwner } from "@/lib/admin-auth";
import { isSameOrigin, jsonError } from "@/lib/http";

// `owner` limits a route to the main admins named in ADMIN_OWNERS.
export function requireAdmin(request: NextRequest, mutating: boolean, options: { owner?: boolean } = {}): { error: NextResponse } | { admin: string } {
  const admin = currentAdmin(request.cookies.get(adminCookieName())?.value);
  if (!admin) return { error: jsonError("Sign in as an admin first.", 401) };
  if (options.owner && !isOwner(admin, adminConfig().owners)) return { error: jsonError("Only the main admins can see this.", 403) };
  if (mutating && !isSameOrigin(request)) return { error: jsonError("Admin changes must come from this site.", 403) };
  return { admin };
}
