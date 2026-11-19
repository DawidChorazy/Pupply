import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { requireAuth } from "../middleware/require-auth";
import { asyncHandler } from "../utils/async-handler";
import { appendWalkPoints, finishWalk, getWalk, startWalk } from "../services/walk.service";
import { finishWalkSchema, walkPageSchema, walkPointsSchema } from "../validation/walk.schemas";

export const walkRouter = Router({ mergeParams: true });
walkRouter.use(requireAuth);
walkRouter.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
walkRouter.use(rateLimit({ windowMs: 60_000, limit: 120, keyGenerator: req => req.auth!.accountId, standardHeaders: "draft-8", legacyHeaders: false }));
walkRouter.get("/", asyncHandler(async (req, res) => {
  res.json(await getWalk(req.auth!.accountId, req.auth!.role, String(req.params.bookingId), walkPageSchema.parse(req.query).after));
}));
walkRouter.post("/start", asyncHandler(async (req, res) => {
  res.status(200).json({ session: await startWalk(req.auth!.accountId, req.auth!.role, String(req.params.bookingId)) });
}));
walkRouter.post("/points", asyncHandler(async (req, res) => {
  res.json(await appendWalkPoints(req.auth!.accountId, req.auth!.role, String(req.params.bookingId), walkPointsSchema.parse(req.body).points));
}));
walkRouter.post("/finish", asyncHandler(async (req, res) => {
  const { endedAt } = finishWalkSchema.parse(req.body ?? {});
  res.json({ session: await finishWalk(req.auth!.accountId, req.auth!.role, String(req.params.bookingId), endedAt) });
}));
