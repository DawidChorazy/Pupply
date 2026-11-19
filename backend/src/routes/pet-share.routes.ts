import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { requireAuth } from "../middleware/require-auth";
import { asyncHandler } from "../utils/async-handler";
import { createPetShare, downloadSharedPetDocument, getSharedPetCard, listPetShares, revokePetShare } from "../services/pet-share.service";

export const petShareRouter = Router({ mergeParams: true });
petShareRouter.use(requireAuth);
petShareRouter.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
petShareRouter.get("/", asyncHandler(async (req, res) => {
  res.json({ shares: await listPetShares(req.auth!.accountId, req.auth!.role, String(req.params.petId)) });
}));
petShareRouter.post("/", asyncHandler(async (req, res) => {
  const input = z.object({ label: z.string().trim().max(80).optional(), includeDocuments: z.boolean().default(false) }).parse(req.body);
  res.status(201).json(await createPetShare(req.auth!.accountId, req.auth!.role, String(req.params.petId), input));
}));
petShareRouter.delete("/:shareId", asyncHandler(async (req, res) => {
  await revokePetShare(req.auth!.accountId, req.auth!.role, String(req.params.petId), String(req.params.shareId));
  res.status(204).send();
}));

export const sharedPetRouter = Router();
sharedPetRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, nosnippet");
  next();
});
sharedPetRouter.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false,
  handler: (req, res) => { res.status(429).json({ error: "RATE_LIMITED", message: "Zbyt wiele żądań. Spróbuj za chwilę.", requestId: req.requestId }); }
}));
sharedPetRouter.get("/card", asyncHandler(async (req, res) => {
  res.json(await getSharedPetCard(req.header("x-pet-share-token")));
}));
sharedPetRouter.get("/documents/:documentId/download", asyncHandler(async (req, res) => {
  res.json(await downloadSharedPetDocument(req.header("x-pet-share-token"), String(req.params.documentId)));
}));
