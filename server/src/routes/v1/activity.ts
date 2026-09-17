import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { fail, ok } from "../../lib/response.js";
import { getLiveActivity } from "../../services/activity.js";

export const activityRouter = Router();

activityRouter.get("/live", (_req, res) => {
  return ok(res, getLiveActivity());
});

activityRouter.post("/product-view", async (req, res) => {
  const productId = parseInt(String(req.body.productId), 10);
  if (Number.isNaN(productId)) return fail(res, 400, "productId required");
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return fail(res, 404, "Product not found");
  await prisma.productView.create({ data: { productId } });
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const viewers = await prisma.productView.count({
    where: { productId, viewedAt: { gte: since } },
  });
  return ok(res, { productId, viewersCount: Math.max(viewers, 1) });
});
