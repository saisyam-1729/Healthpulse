const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['pdf', 'manual'],
    required: true
  },
  // Unified Informatics Storage
  extractedData: [{
    category: { type: String, default: 'General' },
    test_name: String,
    value: Number,
    unit: String,
    range: String,
    status: { type: String, enum: ['low', 'normal', 'high', 'unknown'], default: 'normal' }
  }],
  analysis: {
    healthScore: { type: Number, default: 100 },
    riskLevel: { type: String, enum: ['Low', 'Moderate', 'High'], default: 'Low' },
    summary: { 
      total: { type: Number, default: 0 },
      high: { type: Number, default: 0 },
      low: { type: Number, default: 0 },
      normal: { type: Number, default: 0 }
    },
    abnormal_parameters: [{
      name: String,
      value: Number,
      unit: String,
      status: String
    }],
    predictions: [{
      condition: String,
      confidence: String,
      reason: String
    }],
    recommendations: {
      medical: [String],
      ayurvedic: [String],
      lifestyle: [String]
    },
    skin_analysis: {
      condition: String,
      severity: String,
      advice: [String],
      consult_doctor: Boolean,
      warning: String
    },
    alert: { type: String, default: null },
    alerts: [String] // Keeping for backward compatibility
  },

  contextUsed: {
    onboardingSnapshot: Object,
    sensorSnapshot: Object
  },
  filePath: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Report', reportSchema);
