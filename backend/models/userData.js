import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  userId: String,
  problemId: String,
  /** 1 = Level 1 (one attempt per user+problem); Level 2 rows omit or use separate docs */
  level: Number,
  prompt: String,
  generatedCode: String,
  structureScore: Number,
  predictedSuccess: Number,
  promptScore: Number,
  testPassRate: Number,
  reliabilityScore: Number,
  effectivenessScore: Number,
  ethicalScore: Number,
  outputQualityScore: Number,
securityRating: Number,
compositeScore: Number,
reasonQualityScore: Number,
userHallucinationAnswerCorrect: Boolean,
  hallucinationDetected: Boolean,
  testCasesPassed: Number,
  totalTestCases: Number,
  testCaseDetails: Array,
  aiOutput: String,
  feedback: { type: [String], default: [] },
  timestamp: Date,
});

userSchema.index(
  { userId: 1, problemId: 1, level: 1 },
  { unique: true, partialFilterExpression: { level: 1 } }
);

// ✅ IMPORTANT: default export
const UserData = mongoose.model("UserData", userSchema);

export default UserData;