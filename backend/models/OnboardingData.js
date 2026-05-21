const mongoose = require('mongoose');

const onboardingSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
}, { 
  strict: false, 
  timestamps: true 
});

module.exports = mongoose.model('OnboardingData', onboardingSchema);
