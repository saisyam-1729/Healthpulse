const mongoose = require('mongoose');

const trackEventSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  userId: { type: String, index: true }, // Optional, mapped if logged in
  eventType: { 
    type: String, 
    enum: ['pageview', 'click', 'time'], 
    required: true,
    index: true
  },
  path: { type: String, required: true },
  elementId: { type: String }, // For click events
  timeSpent: { type: Number }, // For time events
  deviceType: { type: String }, // e.g., mobile, desktop
  browser: { type: String },
  timestamp: { type: Date, default: Date.now, index: true }
});

// Compound index for queries like "sessions today on path X"
trackEventSchema.index({ timestamp: -1, eventType: 1 });
trackEventSchema.index({ sessionId: 1, eventType: 1 });

module.exports = mongoose.model('TrackEvent', trackEventSchema);
