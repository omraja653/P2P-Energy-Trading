const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { requireFields } = require('../middleware/validation');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user._id, type: user.type },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '7d' }
  );
}

// Shape returned to clients — never includes passwordHash.
function publicUser(user) {
  return {
    id: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    type: user.type,
    walletAddress: user.walletAddress,
    kycVerified: user.kycVerified,
  };
}

router.post(
  '/register',
  requireFields(['firstName', 'lastName', 'email', 'password']),
  async (req, res, next) => {
    try {
      const { firstName, lastName, email, password, type, walletAddress } = req.body;

      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
      }

      const user = new User({ firstName, lastName, email, type, walletAddress });
      user.password = password; // virtual setter -> hashed into passwordHash on save
      await user.save();

      res.status(201).json({ user: publicUser(user), token: signToken(user) });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ error: 'Email or wallet address already in use' });
      }
      next(err);
    }
  }
);

router.post('/login', requireFields(['email', 'password']), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.json({ user: publicUser(user), token: signToken(user) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
