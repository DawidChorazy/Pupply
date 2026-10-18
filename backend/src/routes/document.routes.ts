import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/require-auth";
import { asyncHandler } from "../utils/async-handler";
import { downloadDocument, listDocuments, prepareDocument, removeDocument, saveDocument } from "../services/document.service";
import { env } from "../config/env";

export const documentRouter = Router({ mergeParams: true });
documentRouter.use(requireAuth);
documentRouter.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
const meta = z.object({ expiresAt: z.iso.date().transform(value => new Date(`${value}T00:00:00Z`)).nullable().optional(), reminderDaysBefore: z.number().int().min(0).max(365).optional() });
documentRouter.get("/", asyncHandler(async (req, res) => {
  res.json({ documents: await listDocuments(req.auth!.accountId, req.auth!.role, String(req.params.petId)) });
}));
documentRouter.post("/upload", asyncHandler(async (req, res) => {
  const input = z.object({ name: z.string().trim().min(1).max(255), sizeBytes: z.number().int().positive().max(env.DOCUMENT_MAX_BYTES) }).parse(req.body);
  res.status(201).json(await prepareDocument(req.auth!.accountId, req.auth!.role, String(req.params.petId), input));
}));
documentRouter.patch("/:documentId", asyncHandler(async (req, res) => {
  res.json({ document: await saveDocument(req.auth!.accountId, req.auth!.role, String(req.params.petId), String(req.params.documentId), meta.parse(req.body)) });
}));
documentRouter.get("/:documentId/download", asyncHandler(async (req, res) => {
  res.json(await downloadDocument(req.auth!.accountId, req.auth!.role, String(req.params.petId), String(req.params.documentId)));
}));
documentRouter.delete("/:documentId", asyncHandler(async (req, res) => {
  await removeDocument(req.auth!.accountId, req.auth!.role, String(req.params.petId), String(req.params.documentId));
  res.status(204).send();
}));
