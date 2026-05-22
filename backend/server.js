import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

// imports
import level1Routes from "./routes/level1.js";
import level2Routes from "./routes/level2.js";
import level3Routes from "./routes/level3.js";
import leaderboardRoutes from "./routes/leaderboard.js";
import { getLeaderboard } from "./controllers/leaderboardController.js";
import authRoutes from "./routes/auth.js";
import analyticsRoutes from "./routes/analytics.js";

const PORT = Number(process.env.PORT) || 3000;

if (!process.env.MONGO_URI) {
  console.warn(
    "⚠️  MONGO_URI missing in backend/.env — API routes may fail until MongoDB is configured."
  );
}

process.on("unhandledRejection", (reason) => {
  console.error("[server] unhandledRejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[server] uncaughtException:", err);
  process.exit(1);
});

console.log("🔥 Server file started");
console.log("[server] leaderboard API: aggregated v2 (buildLeaderboard)");

const app = express();

app.use(cors());
app.use(express.json());

if (process.env.MONGO_URI) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) => console.error("❌ MongoDB connection error:", err.message));
} else {
  console.error("❌ MongoDB not connected — set MONGO_URI in backend/.env");
}

app.use("/api/auth", authRoutes);
app.use("/api/level1", level1Routes);
app.use("/api/level2", level2Routes);
app.use("/api/level3", level3Routes);
app.get("/api/leaderboard", getLeaderboard);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/analytics", analyticsRoutes);

app.get("/", (req, res) => {
  res.send("Server working ✅");
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `❌ Port ${PORT} is already in use. Stop the other process:\n` +
        `   lsof -ti :${PORT} | xargs kill -9`
    );
  } else {
    console.error("❌ Server failed to start:", err.message);
  }
  process.exit(1);
});
