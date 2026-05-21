const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || "healthpulse_fallback_secret_2026_secure_default";
if (!process.env.JWT_SECRET) {
  console.warn('[WARNING] JWT_SECRET is missing in environment variables. Using fallback secret. THIS IS NOT RECOMMENDED FOR PRODUCTION.');
}

exports.signup = async (req, res) => {
  try {
    const { email, password, data } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword, ...data });
    await newUser.save();

    const token = jwt.sign({ id: newUser._id, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ 
      session: { access_token: token },
      user: { id: newUser._id, email: newUser.email, user_metadata: data } 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check for hardcoded admin login
    if (email === 'admin' && password === 'admin@@@123') {
       let adminUser = await User.findOne({ email: 'admin' });
       if (!adminUser) {
         adminUser = new User({ email: 'admin', password: await bcrypt.hash(password, 10), role: 'admin' });
         await adminUser.save();
       }
       const token = jwt.sign({ id: adminUser._id, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
       return res.json({
         session: { access_token: token },
         user: { id: adminUser._id, email: 'admin', role: 'admin', user_metadata: { name: 'Admin' } },
         onboarding_completed: true
       });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    // Update login tracking
    user.loginCount = (user.loginCount || 0) + 1;
    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign({ id: user._id, role: user.role || 'user' }, JWT_SECRET, { expiresIn: '7d' });
    
    // Check onboarding
    const OnboardingData = require('../models/OnboardingData');
    const onboarding = await OnboardingData.findOne({ user_id: user._id });
    
    res.json({
      session: { access_token: token },
      user: { 
        id: user._id, 
        email: user.email, 
        role: user.role || 'user',
        user_metadata: { name: user.name, phone: user.phone, age: user.age, gender: user.gender } 
      },
      onboarding_completed: !!onboarding
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ 
      user: { 
        id: user._id, 
        email: user.email, 
        role: user.role,
        user_metadata: { name: user.name, phone: user.phone, age: user.age, gender: user.gender } 
      } 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
