const { body, validationResult } = require('express-validator');

// Error handler middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Auth Validation
const validateSignup = [
  body('email').isEmail().withMessage('Enter a valid email address').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  handleValidationErrors
];

const validateLogin = [
  body('email').isEmail().withMessage('Enter a valid email address').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors
];

// Onboarding Validation
const validateOnboarding = [
  body('age').optional({ checkFalsy: true }).isInt({ min: 1, max: 120 }).withMessage('Invalid age'),
  body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
  handleValidationErrors
];

// Feedback Validation
const validateFeedback = [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').notEmpty().withMessage('Comment is required').trim().escape(),
  handleValidationErrors
];

module.exports = {
  validateSignup,
  validateLogin,
  validateOnboarding,
  validateFeedback
};
