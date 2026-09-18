import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const adsUploadRoot = path.resolve(__dirname, "../../../public/uploads/ads");

export const MAX_AD_IMAGE_BYTES = 3 * 1024 * 1024;
export const AD_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function publicAdPayload(ad: {
  slot: number;
  title: string | null;
  priceText: string | null;
  offerText: string | null;
  description: string | null;
  linkUrl: string | null;
  imageUrl: string;
  isActive: boolean;
}) {
  return {
    slot: ad.slot,
    title: ad.title,
    priceText: ad.priceText,
    offerText: ad.offerText,
    description: ad.description,
    linkUrl: ad.linkUrl,
    imageUrl: ad.imageUrl,
    isActive: ad.isActive,
  };
}

export async function ensureAdsUploadDir() {
  await fs.mkdir(adsUploadRoot, { recursive: true });
  return adsUploadRoot;
}

export async function deleteAdFile(imageUrl: string) {
  if (!imageUrl.startsWith("/uploads/ads/")) return;
  const rel = imageUrl.replace(/^\/uploads\/ads\//, "");
  const abs = path.join(adsUploadRoot, rel);
  await fs.unlink(abs).catch(() => undefined);
}
