const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  severity: { type: String, enum: ['low', 'moderate', 'high'], default: 'low' },
  resolved: { type: Boolean, default: false },
}, { 
  strict: false, 
  timestamps: true 
});

module.exports = mongoose.model('Alert', alertSchema);
