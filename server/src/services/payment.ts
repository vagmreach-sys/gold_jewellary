import crypto from "crypto";
import Razorpay from "razorpay";
import { prisma } from "../lib/prisma.js";

function getRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export async function createRazorpayOrder(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");
  if (order.status !== "PENDING_PAYMENT") throw new Error("Order is not payable");

  const instance = getRazorpay();
  if (!instance) {
    throw new Error("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server/.env");
  }

  const rzOrder = await instance.orders.create({
    amount: order.grandTotal * 100,
    currency: "INR",
    receipt: order.orderNumber,
    notes: { orderId: order.id },
  });

  await prisma.order.update({
    where: { id: orderId },
    data: { razorpayOrderId: rzOrder.id },
  });

  return {
    keyId: process.env.RAZORPAY_KEY_ID!,
    razorpayOrderId: rzOrder.id,
    amount: order.grandTotal * 100,
    currency: "INR",
    orderNumber: order.orderNumber,
  };
}

export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return expected === signature;
}
