import { Router } from "express";
import { prisma } from "../../../lib/prisma.js";
import { fail, ok } from "../../../lib/response.js";
import { requireRole } from "../../../middleware/auth.js";

export const adminShipmentsRouter = Router();
adminShipmentsRouter.use(requireRole("ADMIN"));

adminShipmentsRouter.patch("/:id", async (req, res) => {
  const shipment = await prisma.shipment.findUnique({
    where: { id: req.params.id },
    include: { order: true },
  });
  if (!shipment) return fail(res, 404, "Shipment not found");

  const { awb, carrier, orderStatus, event } = req.body as {
    awb?: string;
    carrier?: string;
    orderStatus?: string;
    event?: { title: string; description?: string };
  };

  const shipmentUpdate: { awb?: string; carrier?: string } = {};
  if (awb?.trim()) shipmentUpdate.awb = awb.trim();
  if (carrier?.trim()) shipmentUpdate.carrier = carrier.trim();

  const updated = await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      ...shipmentUpdate,
      ...(event?.title
        ? {
            events: {
              create: {
                title: event.title,
                description: event.description ?? "",
                occurredAt: new Date(),
                sortOrder: 0,
              },
            },
          }
        : {}),
    },
    include: { events: { orderBy: { sortOrder: "desc" } }, order: true },
  });

  if (orderStatus) {
    await prisma.order.update({
      where: { id: shipment.orderId },
      data: { status: orderStatus },
    });
  }

  return ok(res, updated);
});
