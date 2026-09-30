const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { jwtSecret } = require('../config/jwtSecret');

// Fields a user must never be able to set on their own account at signup.
const PROTECTED_FIELDS = ['role', 'password', 'email', 'loginCount', 'lastLogin', '_id', 'createdAt', 'updatedAt'];

exports.signup = async (req, res) => {
  try {
    const { email, password, data } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const profile = { ...(data && typeof data === 'object' ? data : {}) };
    PROTECTED_FIELDS.forEach((f) => delete profile[f]);
    const newUser = new User({ ...profile, email, password: hashedPassword, role: 'user' });
    await newUser.save();

    const token = jwt.sign({ id: newUser._id, email: newUser.email, role: 'user' }, jwtSecret(), { expiresIn: '7d' });
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
    
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    // Update login tracking
    user.loginCount = (user.loginCount || 0) + 1;
    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign({ id: user._id, role: user.role || 'user' }, jwtSecret(), { expiresIn: '7d' });
    
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
