import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

// imports
import level1Routes from "./routes/level1.js";
import level2Routes from "./routes/level2.js";
import level3Routes from "./routes/level3.js";
import leaderboardRoutes from "./routes/leaderboard.js";
import { getLeaderboard } from "./controllers/leaderboardController.js";
import authRoutes from "./routes/auth.js"; // ✅ ADD THIS
import analyticsRoutes from "./routes/analytics.js";

console.log("🔥 Server file started");
console.log("[server] leaderboard API: aggregated v2 (buildLeaderboard)");

const app = express();

app.use(cors());
app.use(express.json());

// DB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.log("❌ DB error:", err));

// routes
app.use("/api/auth", authRoutes); // ✅ ADD THIS
app.use("/api/level1", level1Routes);
app.use("/api/level2", level2Routes);
app.use("/api/level3", level3Routes);
// Explicit handler so leaderboard never serves stale UserData.find() from an old module cache
app.get("/api/leaderboard", getLeaderboard);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/analytics", analyticsRoutes);

app.get("/", (req, res) => {
  res.send("Server working ✅");
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});