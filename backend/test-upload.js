const { uploadReport } = require('./controllers/reportController');
const fs = require('fs');
// Mock Mongoose for testing
const mongoose = require('mongoose');
mongoose.model('OnboardingData', new mongoose.Schema({})).findOne = () => ({ exec: () => Promise.resolve({}) });
mongoose.model('HealthData', new mongoose.Schema({})).findOne = () => ({ sort: () => ({ exec: () => Promise.resolve({}) }) });
const Report = mongoose.model('Report', new mongoose.Schema({}, { strict: false }));
Report.prototype.save = function() { return Promise.resolve(this); };
Report.prototype.toObject = function() { return this; };

const mockReq = { 
  file: { 
    path: 'uploads/1776592798844-Blood Report 26-08-24.pdf',
    mimetype: 'application/pdf'
  },
  user: { id: '507f1f77bcf86cd799439011' }
};
const mockRes = {
  status: (code) => { console.log('STATUS:', code); return mockRes; },
  json: (data) => { console.log('JSON:', data); return mockRes; }
};
uploadReport(mockReq, mockRes).catch(console.error);
