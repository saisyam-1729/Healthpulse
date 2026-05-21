const express = require('express');
const router = express.Router();
const { queryGroq } = require('../services/groqService');
const authMiddleware = require('../config/authMiddleware');

/**
 * POST /api/doctor-ai
 * Consult the Groq-powered AI Doctor (Llama-3)
 */
router.post('/doctor-ai', authMiddleware, async (req, res) => {
  const { prompt } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ success: false, message: "Prompt is required" });
  }

  const result = await queryGroq(prompt);
  
  if (!result.success) {
    return res.status(500).json(result);
  }
  
  res.json(result);
});

module.exports = router;
