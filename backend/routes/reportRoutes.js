const express = require('express');
const router = express.Router();
const { uploadReport, manualEntry, getReports, upload } = require('../controllers/reportController');
const authMiddleware = require('../config/authMiddleware');

// All report routes require authentication
router.use(authMiddleware);

router.post("/upload", upload.single("report"), uploadReport);
router.post("/manual", manualEntry);
router.get("/", getReports);

module.exports = router;
