import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { fail, ok } from "../../lib/response.js";
import { attachUser, requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { isValidIndianPincode } from "../../services/shipping.js";

export const meRouter = Router();
meRouter.use(attachUser);
meRouter.use(requireAuth);

function formatAddress(a: {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}) {
  return {
    id: a.id,
    label: a.label,
    recipientName: a.recipientName,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    isDefault: a.isDefault,
  };
}

meRouter.get("/addresses", async (req: AuthedRequest, res) => {
  const list = await prisma.address.findMany({
    where: { userId: req.user!.id },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
  return ok(res, list.map(formatAddress));
});

meRouter.post("/addresses", async (req: AuthedRequest, res) => {
  try {
    const { label, recipientName, phone, line1, line2, city, state, pincode, isDefault } = req.body;
    if (!recipientName || !phone || !line1 || !city || !state || !pincode) {
      return fail(res, 400, "Missing address fields", "VALIDATION_ERROR");
    }
    if (!isValidIndianPincode(pincode)) return fail(res, 400, "Invalid pincode", "VALIDATION_ERROR");

    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId: req.user!.id },
        data: { isDefault: false },
      });
    }

    const count = await prisma.address.count({ where: { userId: req.user!.id } });
    const created = await prisma.address.create({
      data: {
        userId: req.user!.id,
        label: label || "Home",
        recipientName,
        phone,
        line1,
        line2: line2 || null,
        city,
        state,
        pincode,
        isDefault: isDefault ?? count === 0,
      },
    });
    return ok(res, formatAddress(created));
  } catch (e) {
    return fail(res, 400, e instanceof Error ? e.message : "Could not save address");
  }
});

meRouter.patch("/addresses/:id", async (req: AuthedRequest, res) => {
  const addressId = String(req.params.id);
  const existing = await prisma.address.findFirst({
    where: { id: addressId, userId: req.user!.id },
  });
  if (!existing) return fail(res, 403, "Address not found", "FORBIDDEN");

  const updated = await prisma.address.update({
    where: { id: existing.id },
    data: {
      label: req.body.label ?? undefined,
      recipientName: req.body.recipientName ?? undefined,
      phone: req.body.phone ?? undefined,
      line1: req.body.line1 ?? undefined,
      line2: req.body.line2 ?? undefined,
      city: req.body.city ?? undefined,
      state: req.body.state ?? undefined,
      pincode: req.body.pincode ?? undefined,
      isDefault: req.body.isDefault ?? undefined,
    },
  });
  return ok(res, formatAddress(updated));
});

meRouter.delete("/addresses/:id", async (req: AuthedRequest, res) => {
  const addressId = String(req.params.id);
  const existing = await prisma.address.findFirst({
    where: { id: addressId, userId: req.user!.id },
  });
  if (!existing) return fail(res, 403, "Address not found", "FORBIDDEN");
  await prisma.address.delete({ where: { id: existing.id } });
  return ok(res, { deleted: true });
});

meRouter.post("/addresses/:id/default", async (req: AuthedRequest, res) => {
  const addressId = String(req.params.id);
  const existing = await prisma.address.findFirst({
    where: { id: addressId, userId: req.user!.id },
  });
  if (!existing) return fail(res, 403, "Address not found", "FORBIDDEN");
  await prisma.address.updateMany({ where: { userId: req.user!.id }, data: { isDefault: false } });
  const updated = await prisma.address.update({
    where: { id: existing.id },
    data: { isDefault: true },
  });
  return ok(res, formatAddress(updated));
});

meRouter.get("/orders", async (req: AuthedRequest, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const skip = (page - 1) * limit;

  const [total, orders] = await Promise.all([
    prisma.order.count({ where: { userId: req.user!.id } }),
    prisma.order.findMany({
      where: { userId: req.user!.id },
      include: { items: true, shipment: true, payments: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  return ok(res, orders, { page, limit, total });
});
