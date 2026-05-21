const express = require('express');
const router = express.Router();
const axios = require('axios');

/**
 * GET /api/hospitals/nearby
 * Proxy to Overpass API to find hospitals within a given radius.
 * query: lat, lon, radius (in km)
 */
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lon, radius } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ success: false, message: "Latitude and Longitude are required." });
    }

    const rMeters = (radius || 5) * 1000;
    
    // Multiple mirrors for high availability
    const mirrors = [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter"
    ];

    const query = `[out:json][timeout:25];
(
  nwr["amenity"~"hospital|clinic|doctors"](around:${rMeters},${lat},${lon});
  nwr["healthcare"~"hospital|clinic|doctor"](around:${rMeters},${lat},${lon});
);
out center body;`;

    let data = null;
    let error = null;

    for (const mirror of mirrors) {
      try {
        const response = await axios.get(mirror, {
          params: { data: query },
          timeout: 10000 // 10s timeout per mirror
        });
        
        if (response.data && response.data.elements) {
          data = response.data;
          break;
        }
      } catch (err) {
        console.error(`[HospitalProxy] Mirror failed: ${mirror}`, err.message);
        error = err;
      }
    }

    if (!data) {
      return res.status(503).json({ 
        success: false, 
        message: "Discovery mirrors currently unreachable.",
        error: error?.message 
      });
    }

    res.json({ success: true, data });

  } catch (err) {
    console.error("[HospitalProxy] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
