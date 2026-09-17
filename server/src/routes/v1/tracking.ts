import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { fail, ok } from "../../lib/response.js";

export const trackingRouter = Router();

trackingRouter.get("/:identifier", async (req, res) => {
  const id = req.params.identifier.trim();
  const shipment = await prisma.shipment.findFirst({
    where: {
      OR: [
        { awb: id },
        { order: { customerPhone: { contains: id.replace(/\D/g, "").slice(-10) } } },
        { order: { orderNumber: id } },
      ],
    },
    include: {
      order: true,
      events: { orderBy: { sortOrder: "desc" } },
    },
  });

  if (!shipment) return fail(res, 404, "Tracking not found");

  return ok(res, {
    awb: shipment.awb,
    carrier: shipment.carrier,
    orderNumber: shipment.order.orderNumber,
    status: shipment.order.status,
    timeline: shipment.events.map((e) => ({
      title: e.title,
      description: e.description,
      occurredAt: e.occurredAt.toISOString(),
    })),
  });
});
