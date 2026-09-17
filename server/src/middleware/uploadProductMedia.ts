import fs from "fs";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import { ensureProductUploadDir, MAX_PHOTO_BYTES, MAX_VIDEO_BYTES } from "../services/productMedia.js";

const storage = multer.diskStorage({
  destination: async (req, _file, cb) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const dir = await ensureProductUploadDir(id);
      cb(null, dir);
    } catch (e) {
      cb(e instanceof Error ? e : new Error("Upload path failed"), "");
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.mimetype.startsWith("video/") ? ".mp4" : ".jpg");
    cb(null, `${randomUUID()}${ext.toLowerCase()}`);
  },
});

function fileFilter(
  _req: import("express").Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) {
  const ok =
    file.mimetype.startsWith("image/") ||
    file.mimetype === "video/mp4" ||
    file.mimetype === "video/webm";
  cb(null, ok);
}

export const productMediaUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_VIDEO_BYTES, files: 13 },
});

export const uploadProductMediaFields = productMediaUpload.fields([
  { name: "photos", maxCount: 12 },
  { name: "video", maxCount: 1 },
]);
