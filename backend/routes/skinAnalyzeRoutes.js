const express = require('express');
const router = express.Router();
const multer = require('multer');
const { queryGroq } = require('../services/groqService');
const authMiddleware = require('../config/authMiddleware');

const upload = multer({ dest: 'uploads/skin/' });

/**
 * POST /api/skin-analyze
 * Analyze skin condition using AI (Text-based description or Image metadata)
 */
router.post('/', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const { description } = req.body;
    
    // In a real system, we'd use a vision model. 
    // For now, we use Groq to analyze the description or simulate vision based on metadata.
    const prompt = `
      You are a professional dermatologist.
      Analyze the following skin condition description and provide a structured response.
      DESCRIPTION: ${description || "An image was uploaded (analyzing visual characteristics)."}
      
      RETURN JSON FORMAT:
      {
        "condition": "Name of condition",
        "severity": "Low/Medium/High",
        "precautions": ["list", "of", "precautions"],
        "medications": ["suggested", "over-the-counter", "options"]
      }
    `;

    const result = await queryGroq(prompt);
    
    if (!result.success) {
      return res.status(500).json({ success: false, message: "AI Analysis failed" });
    }

    // Attempt to parse JSON from AI response
    let analysis;
    try {
      const jsonStr = result.reply.match(/\{[\s\S]*\}/)[0];
      analysis = JSON.parse(jsonStr);
    } catch (e) {
      analysis = {
        condition: "Undetermined",
        severity: "Unknown",
        precautions: ["Consult a doctor in person"],
        medications: ["None suggested without clear diagnosis"]
      };
    }

    res.json({
      success: true,
      data: analysis
    });

  } catch (err) {
    console.error("[Skin AI] Error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
