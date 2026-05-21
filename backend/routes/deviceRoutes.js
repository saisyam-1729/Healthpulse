const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const UserDevice = require('../models/UserDevice');
const HealthData = require('../models/HealthData');
const authMiddleware = require('../config/authMiddleware');
const deviceAuth = require('../middleware/deviceAuth');

// 1. POST /api/device/register
// Register device on startup
router.post('/register', deviceAuth, async (req, res) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) return res.status(400).json({ error: "deviceId is required" });

    // Find or create device (do not overwrite existing)
    let device = await Device.findOne({ deviceId });
    if (!device) {
      device = new Device({ deviceId, status: 'offline', lastSeen: new Date() });
      await device.save();
      return res.status(201).json({ message: "Device registered", device });
    }
    
    res.json({ message: "Device already registered", device });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const { analyzeUserHealth } = require('../services/healthService');

// 2. POST /api/device/data
// Update status and lastSeen from ESP32
router.post('/data', deviceAuth, async (req, res) => {
  try {
    const { deviceId, heartRate, spo2, temperature } = req.body;
    if (!deviceId) return res.status(400).json({ error: "deviceId is required" });

    // Validation Rules
    const isValidHR = heartRate === null || (heartRate >= 30 && heartRate <= 220);
    const isValidSpO2 = spo2 === null || (spo2 >= 0 && spo2 <= 100);
    const isValidTemp = temperature === null || (temperature >= 30 && temperature <= 45);

    if (!isValidHR || !isValidSpO2 || !isValidTemp) {
      return res.status(400).json({ error: "Invalid sensor data ranges" });
    }

    // 1. Update/Create Device status (Auto-registration)
    const device = await Device.findOneAndUpdate(
      { deviceId },
      { status: 'online', lastSeen: new Date() },
      { upsert: true, new: true }
    );

    try {
      // 2. Find associated user and save health data
      // Prioritize req.user if synchronized from frontend, else fallback to mapping
      let linkedUserId = req.user ? req.user.id : null;
      if (!linkedUserId) {
        const mapping = await UserDevice.findOne({ deviceId });
        if (mapping) linkedUserId = mapping.userId;
      }

      if (linkedUserId && (heartRate !== null || spo2 !== null)) {
        const newHealthRecord = new HealthData({
          userId: linkedUserId,
          deviceId: deviceId,
          heartRate: heartRate || 0,
          spo2: spo2 || 0,
          temperature: temperature || 36.5
        });
        await newHealthRecord.save();
        console.log(`[IoT] Saved data for User: ${linkedUserId} via Device: ${deviceId}`);
        
        // 3. Trigger ASYNC intelligent analysis (Non-blocking)
        analyzeUserHealth(linkedUserId, { heartRate, spo2, temperature }, deviceId)
          .catch(err => console.error("[IoT] Analysis Background Error:", err));

      } else if (!linkedUserId) {
        console.log(`[IoT] Ignored data for unmapped Device: ${deviceId}`);
      }
    } catch (saveErr) {
      console.error("[IoT] Database Save Error:", saveErr);
      // We still proceed to return 200 so the ESP32 doesn't error out
    }
    
    res.json({ message: "Status updated and data processed", device });
  } catch (err) {
    console.error("Device data global error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 3. GET /api/device
// List all devices
router.get('/', async (req, res) => {
  try {
    const devices = await Device.find().sort({ lastSeen: -1 });
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. POST /api/device/connect
// Map a user to a device
router.post('/connect', authMiddleware, async (req, res) => {
  try {
    const { userId, deviceId } = req.body;
    if (!userId || !deviceId) return res.status(400).json({ error: "userId and deviceId are required" });

    const mapping = await UserDevice.findOneAndUpdate(
      { userId, deviceId },
      { userId, deviceId },
      { upsert: true, new: true }
    );

    res.json({ message: "Device connected to user", mapping });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. GET /api/device/:userId
// Fetch latest health readings for a specific user
router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Safety check: Ensure the requester is viewing their own data
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied" });
    }

    const data = await HealthData.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20);

    // Format for Dashboard: reverse for chart (oldest to newest)
    const formattedData = data.map(record => ({
      heart_rate: record.heartRate,
      spo2: record.spo2,
      temperature: record.temperature,
      timestamp: record.createdAt.toISOString()
    })).reverse();

    res.json(formattedData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
