import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  userId: String,
  problemId: String,
  prompt: String,
  generatedCode: String,
  structureScore: Number,
  promptScore: Number,
  reliabilityScore: Number,
  effectivenessScore: Number,
  ethicalScore: Number,
  hallucinationDetected: Boolean,
  testCasesPassed: Number,
  totalTestCases: Number,
  testCaseDetails: Array,
  aiOutput: String,
  feedback: { type: [String], default: [] },
  timestamp: Date
});

// ✅ IMPORTANT: default export
const UserData = mongoose.model("UserData", userSchema);

export default UserData;