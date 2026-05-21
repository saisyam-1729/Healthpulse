const HealthData = require('../models/HealthData');

/**
 * Fetch latest health records for the logged-in user
 */
exports.getHealthData = async (req, res) => {
  try {
    const userId = req.user.id;
    // Return latest 20 records, sorted by time descending, then reversed for the chart
    const data = await HealthData.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20);
    
    // Map to the format the frontend expects (heart_rate, spo2, temperature, timestamp)
    const formattedData = data.map(record => ({
      heart_rate: record.heartRate,
      spo2: record.spo2,
      temperature: record.temperature,
      timestamp: record.createdAt.toISOString()
    })).reverse();

    res.json(formattedData);
  } catch (err) {
    console.error("Error fetching health data:", err);
    res.status(500).json({ error: "Failed to fetch health data" });
  }
};

/**
 * Save sensor data from ESP32
 */
exports.saveHealthData = async (req, res) => {
  try {
    const { userId, heartRate, spo2, temperature } = req.body;

    if (!userId || heartRate === undefined || spo2 === undefined || temperature === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newRecord = new HealthData({
      userId,
      heartRate,
      spo2,
      temperature
    });

    await newRecord.save();
    res.status(201).json({ message: "Data saved successfully", record: newRecord });
  } catch (err) {
    console.error("Error saving health data:", err);
    res.status(500).json({ error: "Failed to save health data" });
  }
};
