import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import type { ProductMedia } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadsRoot = path.resolve(__dirname, "../../../public/uploads/products");

export const MAX_PHOTOS_PER_PRODUCT = 12;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const PHOTO_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_MIMES = new Set(["video/mp4", "video/webm"]);

export function publicMediaPayload(rows: ProductMedia[]) {
  return rows
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime())
    .map((m) => ({
      id: m.id,
      type: m.type,
      url: m.url,
      mimeType: m.mimeType,
      sortOrder: m.sortOrder,
      isPrimary: m.isPrimary,
    }));
}

export function primaryImageFromMedia(media: ReturnType<typeof publicMediaPayload>) {
  const photos = media.filter((m) => m.type === "PHOTO");
  const primary = photos.find((p) => p.isPrimary) || photos[0];
  return primary?.url ?? null;
}

export async function loadProductMediaMap(productIds: number[]) {
  if (!productIds.length) return new Map<number, ReturnType<typeof publicMediaPayload>>();
  const rows = await prisma.productMedia.findMany({
    where: { productId: { in: productIds } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const map = new Map<number, ReturnType<typeof publicMediaPayload>>();
  for (const row of rows) {
    const list = map.get(row.productId) ?? [];
    list.push({
      id: row.id,
      type: row.type,
      url: row.url,
      mimeType: row.mimeType,
      sortOrder: row.sortOrder,
      isPrimary: row.isPrimary,
    });
    map.set(row.productId, list);
  }
  return map;
}

export function mediaTypeFromMime(mime: string): "PHOTO" | "VIDEO" | null {
  if (PHOTO_MIMES.has(mime)) return "PHOTO";
  if (VIDEO_MIMES.has(mime)) return "VIDEO";
  return null;
}

export async function ensureProductUploadDir(productId: number) {
  const dir = path.join(uploadsRoot, String(productId));
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function deleteMediaFile(url: string) {
  if (!url.startsWith("/uploads/products/")) return;
  const rel = url.replace(/^\/uploads\/products\//, "");
  const abs = path.join(uploadsRoot, rel);
  await fs.unlink(abs).catch(() => undefined);
}

export async function countPhotos(productId: number) {
  return prisma.productMedia.count({
    where: { productId, type: "PHOTO" },
  });
}

export async function getExistingVideo(productId: number) {
  return prisma.productMedia.findFirst({
    where: { productId, type: "VIDEO" },
  });
}
