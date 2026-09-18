import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { ok } from "../../lib/response.js";
import { publicAdPayload } from "../../services/storefrontAdMedia.js";

export const storefrontRouter = Router();

storefrontRouter.get("/ads", async (_req, res) => {
  const rows = await prisma.storefrontAd.findMany({
    where: { isActive: true, slot: 1 },
    take: 1,
  });
  return ok(res, { ads: rows.map(publicAdPayload) });
});
