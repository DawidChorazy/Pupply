import { Router } from "express";
import { requireAuth } from "../middleware/require-auth";
import {
  claimQuest,
  getLeaderboard,
  getQuests
} from "../services/gamification.service";
import { asyncHandler } from "../utils/async-handler";

export const gamificationRouter = Router();
gamificationRouter.use(requireAuth);
gamificationRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
gamificationRouter.get(
  "/quests",
  asyncHandler(async (req, res) => {
    res.json(await getQuests(req.auth!.accountId, req.auth!.role));
  })
);
gamificationRouter.post(
  "/quests/:questId/claim",
  asyncHandler(async (req, res) => {
    res.json(
      await claimQuest(
        req.auth!.accountId,
        req.auth!.role,
        String(req.params.questId)
      )
    );
  })
);
gamificationRouter.get(
  "/leaderboard",
  asyncHandler(async (req, res) => {
    res.json(await getLeaderboard(req.auth!.accountId, req.auth!.role));
  })
);
