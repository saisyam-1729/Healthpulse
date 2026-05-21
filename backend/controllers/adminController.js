const User = require('../models/User');
const Feedback = require('../models/Feedback');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || "healthpulse_fallback_secret_2026_secure_default";

exports.adminLogin = (req, res) => {
  const { username, password } = req.body;
  console.log("Admin login attempt:", req.body);

  if (username === "admin" && password === "admin@@@123") {
    // Generate a real JWT so protected admin routes can verify it
    const token = jwt.sign(
      { id: 'admin', role: 'admin', username: 'admin' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    return res.status(200).json({
      success: true,
      token
    });
  }

  return res.status(401).json({
    success: false,
    message: "Invalid admin credentials"
  });
};

exports.getStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: { $ne: 'admin' } });
    const users = await User.find({ role: { $ne: 'admin' } }, 'loginCount');
    const totalLogins = users.reduce((sum, user) => sum + (user.loginCount || 0), 0);
    const totalFeedbacks = await Feedback.countDocuments();

    res.json({ totalUsers, totalLogins, totalFeedbacks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getFeedbacks = async (req, res) => {
  try {
    const feedbacks = await Feedback.find().sort({ createdAt: -1 });
    res.json(feedbacks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { email, role } = req.body;
    await User.findByIdAndUpdate(req.params.id, { email, role });
    res.json({ message: "User updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const OnboardingData = require('../models/OnboardingData');
    const Device = require('../models/Device');
    const Alert = require('../models/Alert');

    // Cascade delete all related data
    await Promise.all([
      User.findByIdAndDelete(userId),
      OnboardingData.deleteMany({ user_id: userId }),
      Feedback.deleteMany({ user_id: userId }),
      Device.deleteMany({ user_id: userId }),
      Alert.deleteMany({ user_id: userId }),
    ]);

    res.json({ message: "User and all related data deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updatePassword = async (req, res) => {
  try {
    const { password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await User.findByIdAndUpdate(req.params.id, { password: hashedPassword });
    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.exportUsersCSV = async (req, res) => {
  try {
    const users = await User.find({}, 'email role loginCount lastLogin createdAt');
    let csv = "Email,Role,Login Count,Last Login,Created At\n";
    users.forEach(u => {
      csv += `${u.email},${u.role},${u.loginCount || 0},${u.lastLogin ? u.lastLogin.toISOString() : "Never"},${u.createdAt.toISOString()}\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
    res.status(200).send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.exportFeedbackCSV = async (req, res) => {
  try {
    const feedbacks = await Feedback.find();
    let csv = "Username,Rating,Suggestion,Date,Time\n";
    feedbacks.forEach(f => {
      const date = new Date(f.createdAt);
      csv += `${f.username},${f.rating},"${f.comment.replace(/"/g, '""')}",${date.toLocaleDateString()},${date.toLocaleTimeString()}\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=feedback.csv');
    res.status(200).send(csv);
    res.status(200).send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUserHealthAnalysis = async (req, res) => {
  try {
    const HealthAnalysis = require('../models/HealthAnalysis');
    const analyses = await HealthAnalysis.find({ user_id: req.params.userId }).sort({ timestamp: -1 });
    res.json(analyses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const TrackEvent = require('../models/TrackEvent');
    
    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const fiveMinsAgo = new Date(now.getTime() - 5 * 60000);
    const adminFilter = { $not: /^\/admin/ };

    // Active Users: unique sessionIds in last 5 mins
    const activeUsers = await TrackEvent.distinct('sessionId', { timestamp: { $gte: fiveMinsAgo }, path: adminFilter });
    
    // Sessions Today: unique sessionIds since todayStart
    const sessionsToday = await TrackEvent.distinct('sessionId', { timestamp: { $gte: todayStart }, path: adminFilter });

    // Avg Session Time (in seconds)
    // Find 'time' events for today, calculate average
    const timeEvents = await TrackEvent.find({ eventType: 'time', timestamp: { $gte: todayStart }, path: adminFilter });
    const totalTime = timeEvents.reduce((acc, ev) => acc + (ev.timeSpent || 0), 0);
    const avgSessionTime = sessionsToday.length > 0 ? Math.round(totalTime / sessionsToday.length) : 0;

    // Bounce Rate: Sessions with exactly 1 pageview
    const sessionPageviews = await TrackEvent.aggregate([
      { $match: { timestamp: { $gte: todayStart }, eventType: 'pageview', path: adminFilter } },
      { $group: { _id: '$sessionId', count: { $sum: 1 } } }
    ]);
    const singlePageSessions = sessionPageviews.filter(s => s.count === 1).length;
    const bounceRate = sessionPageviews.length > 0 ? Math.round((singlePageSessions / sessionPageviews.length) * 100) : 0;

    // Charts: Activity Over Time (last 24 hours, grouped by hour)
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60000);
    const activityOverTimeAgg = await TrackEvent.aggregate([
      { $match: { timestamp: { $gte: twentyFourHoursAgo }, eventType: 'pageview', path: adminFilter } },
      { $group: {
          _id: { $hour: { date: '$timestamp', timezone: 'Asia/Kolkata' } },
          views: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Format activity for chart (fill missing hours with 0)
    const activityOverTime = [];
    const currentHour = now.getHours();
    for (let i = 0; i < 24; i++) {
      const hourIndex = (currentHour - 23 + i + 24) % 24;
      const found = activityOverTimeAgg.find(a => a._id === hourIndex);
      activityOverTime.push({
        time: `${hourIndex}:00`,
        views: found ? found.views : 0
      });
    }

    // Top Pages
    const topPagesAgg = await TrackEvent.aggregate([
      { $match: { eventType: 'pageview', timestamp: { $gte: todayStart }, path: adminFilter } },
      { $group: { _id: '$path', views: { $sum: 1 } } },
      { $sort: { views: -1 } },
      { $limit: 5 }
    ]);
    const topPages = topPagesAgg.map(p => ({ path: p._id, views: p.views }));

    // Device Distribution
    const devicesAgg = await TrackEvent.aggregate([
      { $match: { eventType: 'pageview', timestamp: { $gte: todayStart }, path: adminFilter } },
      { $group: { _id: '$deviceType', count: { $sum: 1 } } }
    ]);
    const devices = devicesAgg.map(d => ({ name: d._id || 'Desktop', value: d.count }));

    // Live Users (Recent activity)
    const liveUsers = await TrackEvent.find({ timestamp: { $gte: fiveMinsAgo }, path: adminFilter })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    res.json({
      stats: { activeUsers: activeUsers.length, sessionsToday: sessionsToday.length, avgSessionTime, bounceRate },
      charts: { activityOverTime, topPages, devices },
      liveUsers
    });

  } catch (err) {
    console.error("Analytics Error:", err);
    res.status(500).json({ error: err.message });
  }
};

