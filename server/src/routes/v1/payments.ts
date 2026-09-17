import { Router } from "express";
import { fail, ok } from "../../lib/response.js";
import { confirmCod } from "../../services/orders.js";
import { createRazorpayOrder, verifyRazorpaySignature } from "../../services/payment.js";
import { markOrderPaid } from "../../services/orders.js";
import { prisma } from "../../lib/prisma.js";
import { attachUser, requireAuth, type AuthedRequest } from "../../middleware/auth.js";

export const paymentsRouter = Router();
paymentsRouter.use(attachUser);
paymentsRouter.use(requireAuth);

async function assertOrderOwner(orderId: string, userId: string, role: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");
  if (role !== "ADMIN" && order.userId !== userId) throw new Error("Forbidden");
  return order;
}

paymentsRouter.post("/razorpay/create", async (req: AuthedRequest, res) => {
  try {
    const orderId = req.body.orderId as string;
    if (!orderId) return fail(res, 400, "orderId required");
    await assertOrderOwner(orderId, req.user!.id, req.user!.role);
    const data = await createRazorpayOrder(orderId);
    return ok(res, data);
  } catch (e) {
    return fail(res, 400, e instanceof Error ? e.message : "Payment init failed");
  }
});

paymentsRouter.post("/razorpay/verify", async (req: AuthedRequest, res) => {
  try {
    const {
      orderId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return fail(res, 400, "Missing payment fields");
    }

    const valid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );
    if (!valid) return fail(res, 400, "Invalid payment signature");

    await assertOrderOwner(orderId, req.user!.id, req.user!.role);

    const paid = await markOrderPaid(orderId, {
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      idempotencyKey: razorpay_payment_id,
    });

    return ok(res, {
      orderId: paid.id,
      orderNumber: paid.orderNumber,
      status: paid.status,
      awb: paid.shipment?.awb,
      carrier: paid.shipment?.carrier,
    });
  } catch (e) {
    return fail(res, 400, e instanceof Error ? e.message : "Verification failed");
  }
});

paymentsRouter.post("/cod", async (req: AuthedRequest, res) => {
  try {
    const orderId = req.body.orderId as string;
    if (!orderId) return fail(res, 400, "orderId required");
    await assertOrderOwner(orderId, req.user!.id, req.user!.role);
    const paid = await confirmCod(orderId);
    return ok(res, {
      orderId: paid.id,
      orderNumber: paid.orderNumber,
      status: paid.status,
      awb: paid.shipment?.awb,
    });
  } catch (e) {
    return fail(res, 400, e instanceof Error ? e.message : "COD failed");
  }
});
