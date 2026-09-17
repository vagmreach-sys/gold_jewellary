import type { Response } from "express";
import { prisma } from "../lib/prisma.js";
import { normalizeMobile, isValidMobile } from "../lib/mobile.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { generateOtp, hashOtp, verifyOtp, otpExpiresAt } from "../lib/otp.js";
import { randomUUID } from "crypto";

const SESSION_COOKIE = "vgm_session";
const SESSION_DAYS = 7;

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

export function setSessionCookie(res: Response, sessionId: string) {
  res.cookie(SESSION_COOKIE, sessionId, sessionCookieOptions());
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export async function getUserFromSession(sessionId: string | undefined) {
  if (!sessionId) return null;
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id: sessionId } }).catch(() => null);
    return null;
  }
  return session.user;
}

async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({
    data: { userId, expiresAt },
  });
  return session;
}

export function publicUser(user: {
  id: string;
  mobile: string;
  role: string;
  name: string | null;
  email: string | null;
  productTermsAcceptedAt?: Date | null;
}) {
  return {
    id: user.id,
    mobile: user.mobile,
    role: user.role,
    name: user.name,
    email: user.email,
    productTermsAccepted: Boolean(user.productTermsAcceptedAt),
  };
}

export async function registerCustomer(mobileRaw: string, password: string, name?: string) {
  const mobile = normalizeMobile(mobileRaw);
  if (!isValidMobile(mobile)) throw new Error("Invalid mobile number");
  if (password.length < 6) throw new Error("Password must be at least 6 characters");

  const existing = await prisma.user.findUnique({ where: { mobile } });
  if (existing) throw new Error("Mobile already registered");

  const passwordHash = await hashPassword(password);
  return prisma.user.create({
    data: {
      mobile,
      passwordHash,
      role: "CUSTOMER",
      name: name?.trim() || null,
    },
  });
}

export async function loginWithPassword(mobileRaw: string, password: string) {
  const mobile = normalizeMobile(mobileRaw);
  const user = await prisma.user.findUnique({ where: { mobile } });
  if (!user || !user.passwordHash) throw new Error("Invalid credentials");
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new Error("Invalid credentials");
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return user;
}

export async function requestOtp(mobileRaw: string) {
  const mobile = normalizeMobile(mobileRaw);
  if (!isValidMobile(mobile)) throw new Error("Invalid mobile number");

  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  await prisma.otpChallenge.deleteMany({ where: { mobile } });
  await prisma.otpChallenge.create({
    data: { mobile, otpHash, expiresAt: otpExpiresAt(), attempts: 0 },
  });

  if (process.env.OTP_DEV_MODE === "true") {
    console.log(`[OTP dev] mobile=${mobile} otp=${otp}`);
  }

  return { sent: true, devOtp: process.env.OTP_DEV_MODE === "true" ? otp : undefined };
}

export async function verifyOtpLogin(mobileRaw: string, otp: string, name?: string) {
  const mobile = normalizeMobile(mobileRaw);
  const challenge = await prisma.otpChallenge.findFirst({
    where: { mobile },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge || challenge.expiresAt < new Date()) throw new Error("OTP expired");
  if (challenge.attempts >= 5) throw new Error("Too many attempts");

  const valid = await verifyOtp(otp, challenge.otpHash);
  if (!valid) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: challenge.attempts + 1 },
    });
    throw new Error("Invalid OTP");
  }

  await prisma.otpChallenge.delete({ where: { id: challenge.id } });

  let user = await prisma.user.findUnique({ where: { mobile } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        mobile,
        role: "CUSTOMER",
        name: name?.trim() || null,
      },
    });
  } else if (name?.trim() && !user.name) {
    user = await prisma.user.update({ where: { id: user.id }, data: { name: name.trim() } });
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return user;
}

export async function mergeGuestCart(userId: string, guestCartId: string | undefined) {
  if (!guestCartId) return;
  const guestCart = await prisma.cart.findUnique({
    where: { id: guestCartId },
    include: { items: true },
  });
  if (!guestCart || guestCart.items.length === 0) return;

  let userCart = await prisma.cart.findFirst({ where: { userId } });
  if (!userCart) {
    await prisma.cart.update({
      where: { id: guestCartId },
      data: { userId },
    });
    return;
  }

  for (const item of guestCart.items) {
    const existing = await prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: userCart.id, productId: item.productId } },
    });
    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + item.quantity },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: userCart.id,
          productId: item.productId,
          quantity: item.quantity,
        },
      });
    }
  }
  await prisma.cartItem.deleteMany({ where: { cartId: guestCartId } });
  await prisma.cart.delete({ where: { id: guestCartId } }).catch(() => null);
}

export async function issueSessionForUser(
  res: Response,
  user: { id: string },
  guestCartId?: string,
) {
  await mergeGuestCart(user.id, guestCartId);
  const session = await createSession(user.id);
  setSessionCookie(res, session.id);
  return session;
}
