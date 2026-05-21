const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateSignup, validateLogin } = require('../middleware/validator');
const authMiddleware = require('../config/authMiddleware');

router.post('/register', validateSignup, authController.signup);
router.post('/login', validateLogin, authController.login);
router.get('/user', authMiddleware, authController.getUser);

module.exports = router;
