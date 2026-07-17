import { Router } from "express";

import { requireAuth } from "../middleware/require-auth";
import { createPetPhotoUpload } from "../services/storage.service";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";
import { createPetPhotoUploadSchema } from "../validation/upload.schemas";

const uploadRouter = Router();

uploadRouter.post("/pet-photo", requireAuth, asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
  if (req.auth.role !== "USER") throw new AppError(403, "Only users can upload pet photos", "FORBIDDEN");
  const input = createPetPhotoUploadSchema.parse(req.body);
  const upload = await createPetPhotoUpload(req.auth.accountId, input.contentType, input.sizeBytes);
  res.status(201).json(upload);
}));

export { uploadRouter };
