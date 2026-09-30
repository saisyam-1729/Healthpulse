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
  // Sent by firmware >= 2.3 (docs/DATA_COLLECTION_PROTOCOL.md). A row with fingerPresent=false
  // and no values records a sensor gap; a jump in seq means readings were lost in transmission.
  fingerPresent: { type: Boolean, default: null },
  seq: { type: Number, default: null },
  deviceTime: { type: Date, default: null },
  firmwareVersion: { type: String, default: null },
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
