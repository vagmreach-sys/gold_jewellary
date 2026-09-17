import { Router } from "express";
import fs from "fs/promises";
import multer from "multer";
import path from "path";
import { prisma } from "../../../lib/prisma.js";
import { fail, ok } from "../../../lib/response.js";
import { requireRole } from "../../../middleware/auth.js";
import { uploadProductMediaFields } from "../../../middleware/uploadProductMedia.js";
import {
  MAX_PHOTOS_PER_PRODUCT,
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  countPhotos,
  deleteMediaFile,
  getExistingVideo,
  loadProductMediaMap,
  mediaTypeFromMime,
  publicMediaPayload,
} from "../../../services/productMedia.js";

export const adminProductsRouter = Router();
adminProductsRouter.use(requireRole("ADMIN"));

async function productWithMedia(id: number) {
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) return null;
  const mediaRows = await prisma.productMedia.findMany({
    where: { productId: id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return { ...p, media: publicMediaPayload(mediaRows) };
}

adminProductsRouter.get("/", async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(100, parseInt(String(req.query.limit ?? "50"), 10));
  const skip = (page - 1) * limit;
  const [total, products] = await Promise.all([
    prisma.product.count(),
    prisma.product.findMany({ orderBy: { id: "desc" }, skip, take: limit }),
  ]);
  const mediaMap = await loadProductMediaMap(products.map((p) => p.id));
  const withMedia = products.map((p) => ({
    ...p,
    media: mediaMap.get(p.id) ?? [],
  }));
  return ok(res, withMedia, { page, limit, total });
});

adminProductsRouter.post("/:id/media", (req, res, next) => {
  uploadProductMediaFields(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        const message =
          err.code === "LIMIT_FILE_SIZE"
            ? "File too large. Photos max 5MB each; video max 50MB."
            : err.code === "LIMIT_FILE_COUNT"
              ? "Too many files in one upload."
              : err.message;
        return fail(res, 400, message, "VALIDATION_ERROR");
      }
      const message = err instanceof Error ? err.message : "Upload failed";
      return fail(res, 400, message, "VALIDATION_ERROR");
    }
    next();
  });
}, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return fail(res, 400, "Invalid product id");

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return fail(res, 404, "Not found");

  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const photoFiles = files?.photos ?? [];
  const videoFiles = files?.video ?? [];

  if (!photoFiles.length && !videoFiles.length) {
    return fail(
      res,
      400,
      "No valid files received. Use JPEG/PNG/WebP photos (max 5MB each) and one MP4/WebM video (max 50MB).",
    );
  }

  const existingPhotoCount = await countPhotos(id);
  if (existingPhotoCount + photoFiles.length > MAX_PHOTOS_PER_PRODUCT) {
    for (const f of [...photoFiles, ...videoFiles]) {
      await fs.unlink(f.path).catch(() => undefined);
    }
    return fail(res, 400, `Maximum ${MAX_PHOTOS_PER_PRODUCT} photos per product`);
  }

  if (videoFiles.length > 1) {
    for (const f of [...photoFiles, ...videoFiles]) {
      await fs.unlink(f.path).catch(() => undefined);
    }
    return fail(res, 400, "Only one video allowed per product");
  }

  const created: Awaited<ReturnType<typeof prisma.productMedia.create>>[] = [];
  let nextSort =
    (await prisma.productMedia.aggregate({
      where: { productId: id },
      _max: { sortOrder: true },
    }))._max.sortOrder ?? -1;

  try {
    for (const file of photoFiles) {
      const kind = mediaTypeFromMime(file.mimetype);
      if (kind !== "PHOTO") {
        await fs.unlink(file.path).catch(() => undefined);
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        await fs.unlink(file.path).catch(() => undefined);
        return fail(res, 400, "Photo exceeds 5MB limit");
      }
      nextSort += 1;
      const url = `/uploads/products/${id}/${path.basename(file.path)}`;
      const isPrimary = existingPhotoCount === 0 && created.filter((c) => c.type === "PHOTO").length === 0;
      const row = await prisma.productMedia.create({
        data: {
          productId: id,
          type: "PHOTO",
          url,
          mimeType: file.mimetype,
          sortOrder: nextSort,
          isPrimary,
          fileSizeBytes: file.size,
        },
      });
      created.push(row);
    }

    if (videoFiles[0]) {
      const file = videoFiles[0];
      const kind = mediaTypeFromMime(file.mimetype);
      if (kind !== "VIDEO") {
        await fs.unlink(file.path).catch(() => undefined);
        return fail(res, 400, "Invalid video type (use MP4 or WebM)");
      }
      if (file.size > MAX_VIDEO_BYTES) {
        await fs.unlink(file.path).catch(() => undefined);
        return fail(res, 400, "Video exceeds 50MB limit");
      }
      const existingVideo = await getExistingVideo(id);
      if (existingVideo) {
        await deleteMediaFile(existingVideo.url);
        await prisma.productMedia.delete({ where: { id: existingVideo.id } });
      }
      nextSort += 1;
      const url = `/uploads/products/${id}/${path.basename(file.path)}`;
      const row = await prisma.productMedia.create({
        data: {
          productId: id,
          type: "VIDEO",
          url,
          mimeType: file.mimetype,
          sortOrder: nextSort,
          isPrimary: false,
          fileSizeBytes: file.size,
        },
      });
      created.push(row);
    }
  } catch (e) {
    for (const row of created) {
      await deleteMediaFile(row.url);
      await prisma.productMedia.delete({ where: { id: row.id } }).catch(() => undefined);
    }
    const msg = e instanceof Error ? e.message : "Upload failed";
    return fail(res, 400, msg);
  }

  const full = await productWithMedia(id);
  return ok(res, full);
});

adminProductsRouter.delete("/:id/media/:mediaId", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const mediaId = req.params.mediaId;
  const row = await prisma.productMedia.findFirst({
    where: { id: mediaId, productId: id },
  });
  if (!row) return fail(res, 404, "Media not found");

  await deleteMediaFile(row.url);
  await prisma.productMedia.delete({ where: { id: mediaId } });

  if (row.type === "PHOTO" && row.isPrimary) {
    const next = await prisma.productMedia.findFirst({
      where: { productId: id, type: "PHOTO" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    if (next) {
      await prisma.productMedia.update({
        where: { id: next.id },
        data: { isPrimary: true },
      });
    }
  }

  const full = await productWithMedia(id);
  return ok(res, full);
});

adminProductsRouter.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const p = await productWithMedia(id);
  if (!p) return fail(res, 404, "Not found");
  return ok(res, p);
});

adminProductsRouter.post("/", async (req, res) => {
  try {
    const data = req.body;
    if (!data.title || !data.slug || !data.category) {
      return fail(res, 400, "title, slug, category required");
    }
    const created = await prisma.product.create({
      data: {
        title: data.title,
        slug: data.slug,
        category: data.category,
        price: Number(data.price),
        originalPrice: Number(data.originalPrice ?? data.price),
        weight: data.weight ?? "1g",
        stock: Number(data.stock ?? 0),
        rating: Number(data.rating ?? 4.8),
        imageSvg: data.imageSvg ?? "<svg></svg>",
        imageUrl: data.imageUrl ?? null,
        isActive: data.isActive !== false,
      },
    });
    const full = await productWithMedia(created.id);
    return ok(res, full ?? created);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    if (msg.includes("Unique")) return fail(res, 409, "Slug already exists", "CONFLICT");
    return fail(res, 400, msg);
  }
});

adminProductsRouter.patch("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return fail(res, 404, "Not found");

  const data = req.body;
  const updated = await prisma.product.update({
    where: { id },
    data: {
      title: data.title ?? undefined,
      slug: data.slug ?? undefined,
      category: data.category ?? undefined,
      price: data.price !== undefined ? Number(data.price) : undefined,
      originalPrice: data.originalPrice !== undefined ? Number(data.originalPrice) : undefined,
      weight: data.weight ?? undefined,
      stock: data.stock !== undefined ? Math.max(0, Number(data.stock)) : undefined,
      rating: data.rating !== undefined ? Number(data.rating) : undefined,
      imageSvg: data.imageSvg ?? undefined,
      imageUrl: data.imageUrl ?? undefined,
      isActive: data.isActive ?? undefined,
    },
  });
  return ok(res, updated);
});

adminProductsRouter.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const updated = await prisma.product.update({
    where: { id },
    data: { isActive: false },
  });
  return ok(res, updated);
});
