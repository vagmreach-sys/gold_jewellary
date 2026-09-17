import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { fail, ok } from "../../lib/response.js";
import { getAvailableStock } from "../../services/inventory.js";
import {
  loadProductMediaMap,
  primaryImageFromMedia,
  publicMediaPayload,
} from "../../services/productMedia.js";

export const productsRouter = Router();

productsRouter.get("/", async (req, res) => {
  const category = req.query.category as string | undefined;
  const q = (req.query.q as string | undefined)?.toLowerCase();
  const sort = req.query.sort as string | undefined;
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { isActive: true };
  if (category && category !== "all") where.category = category;
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { category: { contains: q } },
    ];
  }

  const orderBy =
    sort === "price_asc"
      ? { price: "asc" as const }
      : sort === "price_desc"
        ? { price: "desc" as const }
        : { id: "asc" as const };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({ where, orderBy, skip, take: limit }),
  ]);

  const mediaMap = await loadProductMediaMap(products.map((p) => p.id));
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const enriched = await Promise.all(
    products.map(async (p) => {
      const viewers = await prisma.productView.count({
        where: { productId: p.id, viewedAt: { gte: since } },
      });
      const availableStock = await getAvailableStock(p.id);
      const media = mediaMap.get(p.id) ?? [];
      return {
        id: p.id,
        slug: p.slug,
        title: p.title,
        category: p.category,
        price: p.price,
        originalPrice: p.originalPrice,
        weight: p.weight,
        stock: p.stock,
        availableStock,
        rating: p.rating,
        imageSvg: p.imageSvg,
        primaryImageUrl: primaryImageFromMedia(media),
        hasVideo: media.some((m) => m.type === "VIDEO"),
        media,
        viewersCount: Math.max(viewers, 3),
      };
    }),
  );

  return ok(res, enriched, { page, limit, total });
});

productsRouter.get("/:id/reviews", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "10"), 10)));
  const skip = (page - 1) * limit;

  const [total, reviews] = await Promise.all([
    prisma.review.count({ where: { productId: id } }),
    prisma.review.findMany({
      where: { productId: id },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  return ok(res, reviews, { page, limit, total });
});

productsRouter.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return fail(res, 400, "Invalid product id");

  const p = await prisma.product.findUnique({ where: { id } });
  if (!p || !p.isActive) return fail(res, 404, "Product not found");

  const since = new Date(Date.now() - 15 * 60 * 1000);
  const viewers = await prisma.productView.count({
    where: { productId: id, viewedAt: { gte: since } },
  });
  const reviewAgg = await prisma.review.aggregate({
    where: { productId: id },
    _avg: { rating: true },
    _count: true,
  });

  const availableStock = await getAvailableStock(id);

  const mediaRows = await prisma.productMedia.findMany({
    where: { productId: id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const media = publicMediaPayload(mediaRows);

  return ok(res, {
    id: p.id,
    slug: p.slug,
    title: p.title,
    category: p.category,
    price: p.price,
    originalPrice: p.originalPrice,
    weight: p.weight,
    stock: p.stock,
    availableStock,
    rating: p.rating,
    imageSvg: p.imageSvg,
    primaryImageUrl: primaryImageFromMedia(media),
    hasVideo: media.some((m) => m.type === "VIDEO"),
    media,
    viewersCount: Math.max(viewers, 3),
    ratingSummary: {
      average: reviewAgg._avg.rating ?? p.rating,
      count: reviewAgg._count,
    },
  });
});
