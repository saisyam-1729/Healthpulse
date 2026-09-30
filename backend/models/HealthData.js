const mongoose = require('mongoose');

const healthDataSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  deviceId: {
    type: String,
    required: false // Optional for manual entries, though usually provided by IoT
  },
  // null means "no valid reading for this channel at this time" - never a placeholder value.
  heartRate: {
    type: Number,
    default: null
  },
  spo2: {
    type: Number,
    default: null
  },
  temperature: {
    type: Number,
    default: null
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, { 
  timestamps: true 
});

// Index for faster querying by user and latest first
healthDataSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('HealthData', healthDataSchema);
