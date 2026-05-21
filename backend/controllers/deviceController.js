const Device = require('../models/Device');

exports.getDevices = async (req, res) => {
  try {
    const devices = await Device.find({ user_id: req.user.id });
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.upsertDevice = async (req, res) => {
  try {
    const { device_id, ...data } = req.body;
    const device = await Device.findOneAndUpdate(
      { user_id: req.user.id, device_id },
      { user_id: req.user.id, device_id, ...data, last_sync: new Date().toISOString() },
      { upsert: true, new: true }
    );
    res.json(device);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
