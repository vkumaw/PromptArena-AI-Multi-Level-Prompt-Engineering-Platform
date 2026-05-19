import express from "express";
import { getLeaderboard } from "../controllers/leaderboardController.js";

const router = express.Router();

console.log("[leaderboard] route module loaded — aggregated rankings v2");

router.get("/", getLeaderboard);

export default router;
