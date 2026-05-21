const mongoose = require('mongoose');

const userDeviceMappingSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  deviceId: { 
    type: String, 
    required: true 
  }
}, { 
  timestamps: true 
});

// One user can have multiple devices, but each mapping should be unique
userDeviceMappingSchema.index({ userId: 1, deviceId: 1 }, { unique: true });

module.exports = mongoose.model('UserDevice', userDeviceMappingSchema);
