import { Router } from "express";
import { prisma } from "../../../lib/prisma.js";
import { fail, ok } from "../../../lib/response.js";
import { requireRole } from "../../../middleware/auth.js";

export const adminOrdersRouter = Router();
adminOrdersRouter.use(requireRole("ADMIN"));

adminOrdersRouter.get("/", async (req, res) => {
  const status = req.query.status as string | undefined;
  const where = status ? { status } : {};
  const orders = await prisma.order.findMany({
    where,
    include: { items: true, user: true, payments: true, shipment: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return ok(res, orders);
});

adminOrdersRouter.get("/:id", async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      items: true,
      user: true,
      payments: true,
      shipment: { include: { events: { orderBy: { sortOrder: "desc" } } } },
    },
  });
  if (!order) return fail(res, 404, "Not found");
  return ok(res, order);
});

adminOrdersRouter.patch("/:id", async (req, res) => {
  const status = req.body.status as string | undefined;
  if (!status) return fail(res, 400, "status required");
  const updated = await prisma.order.update({
    where: { id: req.params.id },
    data: { status },
  });
  return ok(res, updated);
});
