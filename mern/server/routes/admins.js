const express = require('express');
const Admin = require('../models/Admin');
const { adminAuth, superAdminOnly } = require('../middleware/auth');

const router = express.Router();

// Get all admins (super admin only)
router.get('/', adminAuth, superAdminOnly, async (req, res) => {
  try {
    const admins = await Admin.find().populate('company').select('-password');
    res.json(admins);
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Create admin (super admin only)
router.post('/', adminAuth, superAdminOnly, async (req, res) => {
  try {
    const { username, password, fullName, email, role, company, isActive } = req.body;
    
    // Validate required fields
    if (!username || !password || !fullName) {
      return res.status(400).json({ message: 'Нэвтрэх нэр, нууц үг, бүтэн нэр шаардлагатай' });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({ message: 'Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой' });
    }

    // Validate email format if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'И-мэйл хаяг буруу форматтай байна' });
      }
    }

    // Check if username exists
    const existingAdmin = await Admin.findOne({ username });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Энэ нэвтрэх нэр бүртгэлтэй байна' });
    }

    const admin = await Admin.create({
      username,
      password,
      fullName,
      email,
      role,
      company: role === 'company_admin' ? company : undefined,
      isActive: isActive !== undefined ? isActive : true
    });

    const populatedAdmin = await Admin.findById(admin._id).populate('company').select('-password');
    res.status(201).json(populatedAdmin);
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Update admin (super admin only)
router.put('/:id', adminAuth, superAdminOnly, async (req, res) => {
  try {
    const { username, password, fullName, email, role, company, isActive } = req.body;
    
    // Check username uniqueness
    const existingAdmin = await Admin.findOne({ username, _id: { $ne: req.params.id } });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Энэ нэвтрэх нэр өөр админд бүртгэлтэй байна' });
    }

    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ message: 'Админ олдсонгүй' });
    }

    admin.username = username;
    admin.fullName = fullName;
    admin.email = email;
    admin.role = role;
    admin.company = role === 'company_admin' ? company : undefined;
    admin.isActive = isActive !== undefined ? isActive : admin.isActive;
    
    if (password) {
      admin.password = password;
    }

    await admin.save();

    const populatedAdmin = await Admin.findById(admin._id).populate('company').select('-password');
    res.json(populatedAdmin);
  } catch (error) {
    console.error('Update admin error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Delete admin (super admin only)
router.delete('/:id', adminAuth, superAdminOnly, async (req, res) => {
  try {
    // Prevent deleting self
    if (req.params.id === req.admin._id.toString()) {
      return res.status(400).json({ message: 'Өөрийгөө устгах боломжгүй' });
    }

    await Admin.findByIdAndDelete(req.params.id);
    res.json({ message: 'Админ устгагдлаа' });
  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

module.exports = router;
