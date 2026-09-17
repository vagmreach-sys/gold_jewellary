import type { Request, Response, NextFunction } from "express";
import { getUserFromSession } from "../services/authService.js";
import { fail } from "../lib/response.js";

const SESSION_COOKIE = "vgm_session";

export type AuthedRequest = Request & { user?: Awaited<ReturnType<typeof getUserFromSession>> };

export async function attachUser(req: AuthedRequest, _res: Response, next: NextFunction) {
  const sessionId = req.cookies?.[SESSION_COOKIE] as string | undefined;
  req.user = await getUserFromSession(sessionId);
  next();
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return fail(res, 401, "Login required", "LOGIN_REQUIRED");
  }
  next();
}

export function requireRole(role: string) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return fail(res, 401, "Login required", "LOGIN_REQUIRED");
    if (req.user.role !== role) return fail(res, 403, "Forbidden", "FORBIDDEN");
    next();
  };
}
