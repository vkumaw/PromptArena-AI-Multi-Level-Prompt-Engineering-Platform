import express from "express";
import {
  handleLevel1,
  getLevel1History,
} from "../controllers/level1Controller.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET (for browser check)
router.get("/", (req, res) => {
  res.send("Level1 working (use POST)");
});

router.get("/history", verifyToken, getLevel1History);

// 🔐 PROTECTED API
router.post("/", verifyToken, handleLevel1);

export default router;