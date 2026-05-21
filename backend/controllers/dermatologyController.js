const { analyzeSkinCondition } = require('../services/dermatologyService');

/**
 * POST /api/dermatology/analyze
 */
exports.analyzeSkin = async (req, res) => {
    try {
        const { condition_name, confidence_score, symptoms } = req.body;

        if (!condition_name) {
            return res.status(400).json({ 
                success: false, 
                message: "condition_name is required" 
            });
        }

        const analysis = analyzeSkinCondition({
            condition_name,
            confidence_score,
            symptoms: Array.isArray(symptoms) ? symptoms : []
        });

        return res.json({
            success: true,
            data: analysis
        });
    } catch (err) {
        console.error("[Dermatology Controller] Error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error during skin analysis"
        });
    }
};
