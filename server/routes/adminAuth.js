const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Нэвтрэх нэр болон нууц үг шаардлагатай' });
    }

    const admin = await Admin.findOne({ username }).populate('company');
    
    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({ message: 'Нэвтрэх нэр эсвэл нууц үг буруу' });
    }

    const token = jwt.sign(
      { id: admin._id },
      process.env.ADMIN_JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      admin: {
        _id: admin._id,
        username: admin.username,
        fullName: admin.fullName,
        role: admin.role,
        company: admin.company
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Get current admin
router.get('/me', adminAuth, async (req, res) => {
  res.json({
    _id: req.admin._id,
    username: req.admin.username,
    fullName: req.admin.fullName,
    role: req.admin.role,
    company: req.admin.company
  });
});

module.exports = router;
