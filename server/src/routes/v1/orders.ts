import { Router } from "express";
import { getCartId } from "../../lib/cartCookie.js";
import { prisma } from "../../lib/prisma.js";
import { fail, ok } from "../../lib/response.js";
import { createOrder } from "../../services/orders.js";
import { attachUser, requireAuth, type AuthedRequest } from "../../middleware/auth.js";

export const ordersRouter = Router();

ordersRouter.post("/", attachUser, requireAuth, async (req: AuthedRequest, res) => {
  try {
    const cartId = getCartId(req, res);
    const order = await createOrder({
      cartId,
      userId: req.user!.id,
      addressId: req.body.addressId,
      customerName: req.body.customerName,
      customerPhone: req.body.customerPhone,
      address: req.body.address,
      addressLine2: req.body.addressLine2,
      city: req.body.city,
      state: req.body.state,
      pincode: req.body.pincode,
      courier: req.body.courier ?? "bluedart_apex",
    });
    return ok(res, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      checkoutSessionId: order.checkoutSessionId,
      status: order.status,
      grandTotal: order.grandTotal,
      subtotal: order.subtotal,
      gst: order.gst,
    });
  } catch (e) {
    return fail(res, 400, e instanceof Error ? e.message : "Could not create order");
  }
});

ordersRouter.get("/:orderId", attachUser, async (req: AuthedRequest, res) => {
  const orderId = String(req.params.orderId);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      shipment: { include: { events: { orderBy: { sortOrder: "desc" } } } },
      payments: true,
    },
  });
  if (!order) return fail(res, 404, "Order not found");

  if (req.user) {
    if (order.userId && order.userId !== req.user.id && req.user.role !== "ADMIN") {
      return fail(res, 403, "Forbidden", "FORBIDDEN");
    }
  } else {
    const phone = (req.query.phone as string | undefined)?.replace(/\D/g, "").slice(-10);
    if (!phone || order.customerPhone.replace(/\D/g, "").slice(-10) !== phone) {
      return fail(res, 401, "Login or phone required", "LOGIN_REQUIRED");
    }
  }

  return ok(res, order);
});
