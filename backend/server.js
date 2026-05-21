const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
// HealthPulse AI Upgrade (Groq + Skin + PDF v3): 2026-04-24T02:15:00Z

const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// Route Imports
const alertRoutes = require("./routes/alertRoutes");
const authRoutes = require("./routes/authRoutes");
const deviceRoutes = require("./routes/deviceRoutes");
const healthRoutes = require("./routes/healthRoutes");
const onboardingRoutes = require("./routes/onboardingRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const adminRoutes = require("./routes/adminRoutes");
const aiRoutes = require("./routes/aiRoutes");
const reportRoutes = require("./routes/reportRoutes");
const dermatologyRoutes = require("./routes/dermatologyRoutes");
const skinRoutes = require("./routes/skinRoutes");
const doctorAiRoutes = require("./routes/doctorAiRoutes");
const skinAnalyzeRoutes = require("./routes/skinAnalyzeRoutes");
const hospitalRoutes = require("./routes/hospitalRoutes");

const app = express();

// 1. Security Headers
app.use(helmet());

// 2. CORS Configuration
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://health-sepia-three.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8081",
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

app.use(express.json());

// 3. Rate Limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Significantly increased for development and bulk report testing
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});

const reportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 200, // More permissive limit specifically for reports
  message: "Report processing limit reached, please wait a few minutes",
  standardHeaders: true,
  legacyHeaders: false,
});

const deviceLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 500, // Limit each IP to 500 requests per minute for device data (increased for IoT)
  message: "IoT Device rate limit exceeded",
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiters
app.use("/api/", generalLimiter);
app.use("/api/reports", reportLimiter); // Specific limiter for reports
app.use("/api/device", deviceLimiter); // Higher limit for sensor data

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Routes
app.use("/api/alerts", alertRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/device", deviceRoutes); // Alias for IoT integration consistency
app.use("/api/health", healthRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api", doctorAiRoutes); // Mount at /api so router.post('/doctor-ai') works
app.use("/api/reports", reportRoutes);
app.use("/api/dermatology", dermatologyRoutes);
app.use("/api/skin", skinRoutes);
app.use("/api/skin-analyze", skinAnalyzeRoutes);
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/track", require("./routes/trackRoutes"));

// Static for uploads
app.use('/uploads', express.static('uploads'));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ MongoDB Error:", err));

// Test Route
app.get("/", (req, res) => {
  res.send("🚀 HealthPulse AI Backend | System Version: 1.0.3-FAILSAFE | Status: Online");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔥 Server running on http://0.0.0.0:${PORT}`);
});