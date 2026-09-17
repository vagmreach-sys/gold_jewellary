import { Router } from "express";
import { cartIdFromRequest } from "../../lib/cartCookie.js";
import { fail, ok } from "../../lib/response.js";
import {
  clearSessionCookie,
  issueSessionForUser,
  loginWithPassword,
  publicUser,
  registerCustomer,
  requestOtp,
  verifyOtpLogin,
} from "../../services/authService.js";
import type { AuthedRequest } from "../../middleware/auth.js";
import { attachUser, requireAuth } from "../../middleware/auth.js";
import { prisma } from "../../lib/prisma.js";

export const authRouter = Router();

authRouter.use(attachUser);

authRouter.post("/register", async (req, res) => {
  try {
    const user = await registerCustomer(req.body.mobile, req.body.password, req.body.name);
    const guestCartId = cartIdFromRequest(req);
    await issueSessionForUser(res, user, guestCartId);
    return ok(res, { user: publicUser(user) });
  } catch (e) {
    return fail(res, 400, e instanceof Error ? e.message : "Registration failed");
  }
});

authRouter.post("/login/password", async (req, res) => {
  try {
    const user = await loginWithPassword(req.body.mobile, req.body.password);
    const guestCartId = cartIdFromRequest(req);
    await issueSessionForUser(res, user, guestCartId);
    return ok(res, { user: publicUser(user) });
  } catch (e) {
    return fail(res, 401, e instanceof Error ? e.message : "Login failed");
  }
});

authRouter.post("/otp/request", async (req, res) => {
  try {
    const data = await requestOtp(req.body.mobile);
    return ok(res, data);
  } catch (e) {
    return fail(res, 400, e instanceof Error ? e.message : "OTP request failed");
  }
});

authRouter.post("/otp/verify", async (req, res) => {
  try {
    const user = await verifyOtpLogin(req.body.mobile, req.body.otp, req.body.name);
    const guestCartId = cartIdFromRequest(req);
    await issueSessionForUser(res, user, guestCartId);
    return ok(res, { user: publicUser(user) });
  } catch (e) {
    return fail(res, 401, e instanceof Error ? e.message : "OTP verify failed");
  }
});

authRouter.post("/logout", async (req, res) => {
  const sessionId = req.cookies?.vgm_session as string | undefined;
  if (sessionId) await prisma.session.delete({ where: { id: sessionId } }).catch(() => null);
  clearSessionCookie(res);
  return ok(res, { loggedOut: true });
});

authRouter.get("/me", requireAuth, (req: AuthedRequest, res) => {
  return ok(res, { user: publicUser(req.user!) });
});

authRouter.patch("/me", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        name: req.body.name?.trim() ?? undefined,
        email: req.body.email?.trim() ?? undefined,
      },
    });
    return ok(res, { user: publicUser(updated) });
  } catch (e) {
    return fail(res, 400, e instanceof Error ? e.message : "Update failed");
  }
});

authRouter.post("/accept-product-terms", requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (req.body.agreed !== true) {
      return fail(res, 400, "You must agree to continue", "VALIDATION_ERROR");
    }
    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: { productTermsAcceptedAt: new Date() },
    });
    return ok(res, { user: publicUser(updated) });
  } catch (e) {
    return fail(res, 400, e instanceof Error ? e.message : "Could not save agreement");
  }
});
