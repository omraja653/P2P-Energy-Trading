const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { requireFields } = require('../middleware/validation');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '7d' }
  );
}

router.post('/register', requireFields(['name', 'email', 'password']), async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed, role });

    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      token: signToken(user),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', requireFields(['email', 'password']), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      token: signToken(user),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
