const Device = require('../models/Device');

const jwt = require('jsonwebtoken');

const deviceAuth = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const authHeader = req.headers.authorization;
  const { deviceId } = req.body;

  let isAuthenticated = false;

  // 1. Check API Key (ESP32)
  if (apiKey && apiKey === process.env.DEVICE_API_KEY) {
    isAuthenticated = true;
  } 
  // 2. Check JWT (Frontend Sync)
  else if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const JWT_SECRET = process.env.JWT_SECRET || "healthpulse_fallback_secret_2026_secure_default";
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded; // Attach user so backend knows who synced
      isAuthenticated = true;
    } catch (err) {
      console.warn("[Security] JWT validation failed in deviceAuth:", err.message);
    }
  }

  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Invalid or missing API key / Auth token' });
  }

  if (deviceId && !req.user) { // Only strict device check if from IoT (no user context)
    const device = await Device.findOne({ deviceId });
    if (!device) {
      console.warn(`[Security] Unauthorized device access attempt: ${deviceId}`);
      // Allow registration through
      if (req.path !== '/register') {
        // If not registered, we can auto-register below if req.user is absent? Wait, the prompt says "auto-register if not exists" in Step 3.
        // I will remove the block here so the route can handle auto-registration cleanly.
      }
    }
  }

  next();
};

module.exports = deviceAuth;
