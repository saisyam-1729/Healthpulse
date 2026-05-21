const TrackEvent = require('../models/TrackEvent');

exports.trackEvents = async (req, res) => {
  try {
    const { events } = req.body;
    
    if (!events || !Array.isArray(events)) {
      return res.status(400).json({ error: 'Events array is required' });
    }

    if (events.length === 0) {
      return res.status(200).json({ success: true, message: 'Empty batch ignored' });
    }

    // Insert multiple documents at once for performance
    await TrackEvent.insertMany(events);
    
    return res.status(200).json({ success: true, count: events.length });
  } catch (error) {
    console.error('Tracking Error:', error);
    // Return 200 even on error for beacon/tracking to prevent client-side retries if not needed, 
    // but 500 is technically more correct. For stealth tracking, often 200 or 204 is returned regardless.
    return res.status(500).json({ error: 'Failed to process tracking data' });
  }
};
