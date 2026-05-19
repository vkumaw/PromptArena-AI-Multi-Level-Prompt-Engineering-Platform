import express from "express";
import { handleLevel2, getLevel2History } from "../controllers/level2Controller.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/history", verifyToken, getLevel2History);
router.post("/", verifyToken, handleLevel2);

export default router;