import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import { AD_IMAGE_MIMES, MAX_AD_IMAGE_BYTES, ensureAdsUploadDir } from "../services/storefrontAdMedia.js";

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      const dir = await ensureAdsUploadDir();
      cb(null, dir);
    } catch (e) {
      cb(e instanceof Error ? e : new Error("Upload path failed"), "");
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${randomUUID()}${ext.toLowerCase()}`);
  },
});

function fileFilter(
  _req: import("express").Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) {
  cb(null, AD_IMAGE_MIMES.has(file.mimetype));
}

export const storefrontAdUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_AD_IMAGE_BYTES, files: 1 },
});

export const uploadStorefrontAdImage = storefrontAdUpload.single("image");
