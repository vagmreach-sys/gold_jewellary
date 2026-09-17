import { createHash, randomInt } from "crypto";
import { hashPassword, verifyPassword } from "./password.js";

export function generateOtp(): string {
  if (process.env.OTP_DEV_MODE === "true" && process.env.OTP_DEV_CODE) {
    return process.env.OTP_DEV_CODE;
  }
  return String(randomInt(100000, 999999));
}

export async function hashOtp(otp: string): Promise<string> {
  return hashPassword(otp);
}

export async function verifyOtp(otp: string, hash: string): Promise<boolean> {
  return verifyPassword(otp, hash);
}

export function otpExpiresAt(): Date {
  const mins = parseInt(process.env.OTP_TTL_MINUTES ?? "10", 10);
  return new Date(Date.now() + mins * 60 * 1000);
}
