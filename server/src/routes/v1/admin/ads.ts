import { Router } from "express";
import multer from "multer";
import path from "path";
import { prisma } from "../../../lib/prisma.js";
import { fail, ok } from "../../../lib/response.js";
import { requireRole } from "../../../middleware/auth.js";
import { uploadStorefrontAdImage } from "../../../middleware/uploadStorefrontAd.js";
import {
  AD_IMAGE_MIMES,
  deleteAdFile,
  publicAdPayload,
} from "../../../services/storefrontAdMedia.js";

export const adminAdsRouter = Router();
adminAdsRouter.use(requireRole("ADMIN"));

function parseSlot(raw: string) {
  const slot = parseInt(raw, 10);
  if (slot !== 1) return null;
  return slot;
}

adminAdsRouter.get("/", async (_req, res) => {
  const rows = await prisma.storefrontAd.findMany({ orderBy: { slot: "asc" } });
  return ok(res, { ads: rows.map(publicAdPayload) });
});

adminAdsRouter.patch("/:slot", async (req, res) => {
  const slot = parseSlot(req.params.slot);
  if (!slot) return fail(res, 400, "Invalid ad slot", "VALIDATION_ERROR");

  const existing = await prisma.storefrontAd.findUnique({ where: { slot } });
  if (!existing) return fail(res, 404, "No ad uploaded for this slot yet");

  const title =
    req.body.title !== undefined ? String(req.body.title || "").trim() || null : undefined;
  const priceText =
    req.body.priceText !== undefined ? String(req.body.priceText || "").trim() || null : undefined;
  const offerText =
    req.body.offerText !== undefined ? String(req.body.offerText || "").trim() || null : undefined;
  const description =
    req.body.description !== undefined ? String(req.body.description || "").trim() || null : undefined;
  const linkUrl =
    req.body.linkUrl !== undefined ? String(req.body.linkUrl || "").trim() || null : undefined;
  const isActive =
    req.body.isActive !== undefined ? Boolean(req.body.isActive) : undefined;

  const updated = await prisma.storefrontAd.update({
    where: { slot },
    data: {
      title,
      priceText,
      offerText,
      description,
      linkUrl,
      isActive,
    },
  });
  return ok(res, { ad: publicAdPayload(updated) });
});

adminAdsRouter.post("/:slot", (req, res) => {
  uploadStorefrontAdImage(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        const message =
          err.code === "LIMIT_FILE_SIZE"
            ? "Image too large. Max 3MB (JPEG, PNG, or WebP)."
            : err.message;
        return fail(res, 400, message, "VALIDATION_ERROR");
      }
      return fail(res, 400, err instanceof Error ? err.message : "Upload failed");
    }

    const slot = parseSlot(req.params.slot);
    if (!slot) return fail(res, 400, "Invalid ad slot", "VALIDATION_ERROR");

    const file = req.file;
    if (!file) {
      return fail(res, 400, "Choose an image file (JPEG, PNG, or WebP)", "VALIDATION_ERROR");
    }
    if (!AD_IMAGE_MIMES.has(file.mimetype)) {
      await deleteAdFile(`/uploads/ads/${path.basename(file.path)}`);
      return fail(res, 400, "Invalid image type (use JPEG, PNG, or WebP)");
    }

    const title = String(req.body.title || "").trim() || null;
    const priceText = String(req.body.priceText || "").trim() || null;
    const offerText = String(req.body.offerText || "").trim() || null;
    const description = String(req.body.description || "").trim() || null;
    const linkUrl = String(req.body.linkUrl || "").trim() || null;
    const isActive = req.body.isActive !== "false" && req.body.isActive !== false;

    const existing = await prisma.storefrontAd.findUnique({ where: { slot } });
    if (existing) await deleteAdFile(existing.imageUrl);

    const url = `/uploads/ads/${path.basename(file.path)}`;
    const row = await prisma.storefrontAd.upsert({
      where: { slot },
      create: {
        slot,
        title,
        priceText,
        offerText,
        description,
        linkUrl,
        imageUrl: url,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        isActive,
      },
      update: {
        title,
        priceText,
        offerText,
        description,
        linkUrl,
        imageUrl: url,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        isActive,
      },
    });

    return ok(res, { ad: publicAdPayload(row) });
  });
});

adminAdsRouter.delete("/:slot", async (req, res) => {
  const slot = parseSlot(req.params.slot);
  if (!slot) return fail(res, 400, "Invalid ad slot", "VALIDATION_ERROR");

  const existing = await prisma.storefrontAd.findUnique({ where: { slot } });
  if (!existing) return fail(res, 404, "No ad for this slot");

  await deleteAdFile(existing.imageUrl);
  await prisma.storefrontAd.delete({ where: { slot } });
  return ok(res, { removed: true, slot });
});
