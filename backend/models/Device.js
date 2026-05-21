const mongoose = require('mongoose');

const deviceRegistrySchema = new mongoose.Schema({
  deviceId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  status: { 
    type: String, 
    default: 'offline' 
  },
  lastSeen: { 
    type: Date, 
    default: Date.now 
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Device', deviceRegistrySchema);
