const OnboardingData = require('../models/OnboardingData');

exports.getOnboarding = async (req, res) => {
  try {
    const data = await OnboardingData.findOne({ user_id: req.user.id });
    res.json(data || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.saveOnboarding = async (req, res) => {
  try {
    const { user_id, ...data } = req.body;
    const newOnboarding = await OnboardingData.findOneAndUpdate(
      { user_id: req.user.id },
      { user_id: req.user.id, ...data },
      { upsert: true, new: true }
    );
    res.json(newOnboarding);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
