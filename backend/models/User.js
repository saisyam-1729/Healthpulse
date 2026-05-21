const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    loginCount: { type: Number, default: 0 },
    lastLogin: { type: Date }
  }, { 
    strict: false,
    timestamps: true 
  });

module.exports = mongoose.model('User', userSchema);
