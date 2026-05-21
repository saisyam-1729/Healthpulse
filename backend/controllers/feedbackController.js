const Feedback = require('../models/Feedback');

exports.createFeedback = async (req, res) => {
  try {
    const { rating, comment, username } = req.body;
    if (!rating || !comment || !username) {
      return res.status(400).json({ error: "All fields are required" });
    }
    const feedback = new Feedback({
      user_id: req.user.id,
      username,
      rating,
      comment
    });
    await feedback.save();
    res.status(201).json({ message: "Feedback submitted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getFeedback = async (req, res) => {
  try {
    const feedbacks = await Feedback.find().sort({ createdAt: -1 });
    res.json(feedbacks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
