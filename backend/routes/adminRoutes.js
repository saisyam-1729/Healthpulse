const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../config/authMiddleware');
const isAdmin = require('../middleware/isAdmin');

// Public route for admin login
router.post('/login', adminController.adminLogin);

// Protected admin routes
router.use(authMiddleware);
router.use(isAdmin);

router.get('/analytics', adminController.getAnalytics);
router.get('/stats', adminController.getStats);
router.get('/users', adminController.getUsers);
router.get('/feedbacks', adminController.getFeedbacks);
router.get('/export/users', adminController.exportUsersCSV);
router.get('/export/feedbacks', adminController.exportFeedbackCSV);

router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.patch('/users/:id/password', adminController.updatePassword);
router.get('/users/:userId/health', adminController.getUserHealthAnalysis);

module.exports = router;
