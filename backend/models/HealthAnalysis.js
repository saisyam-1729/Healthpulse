const mongoose = require('mongoose');

const healthAnalysisSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  condition: { type: String, required: true },
  healthScore: { type: Number, default: 100 }, // 0-100
  riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  dominantDosha: { type: String },
  type: { type: String, enum: ['NORMAL', 'EMERGENCY'], default: 'NORMAL' },
  recommendations: {
    medicines: [{ name: String, benefit: String }],
    lifestyle: [String],
    diet: [String],
    doshaAdvice: String,
    disclaimer: String
  },
  hospitals: [{
    name: String,
    address: String,
    distance: String,
    contact: String
  }],
  alerts: [{
    type: { type: String },
    severity: String,
    message: String,
    priority: String
  }],
  criticalFlags: [String],
  sensorData: {
    heartRate: Number,
    spo2: Number,
    temperature: Number
  },
  timestamp: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Index for faster lookups
healthAnalysisSchema.index({ user_id: 1, timestamp: -1 });

module.exports = mongoose.model('HealthAnalysis', healthAnalysisSchema);
