const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Worker = require('../models/Worker');

// Admin authentication middleware
exports.adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Нэвтрэх шаардлагатай' });
    }

    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    const admin = await Admin.findById(decoded.id).populate('company');
    
    if (!admin) {
      return res.status(401).json({ message: 'Админ олдсонгүй' });
    }

    req.admin = admin;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Токен буруу эсвэл хугацаа дууссан' });
  }
};

// Super admin only middleware
exports.superAdminOnly = (req, res, next) => {
  if (req.admin.role !== 'super_admin') {
    return res.status(403).json({ message: 'Зөвхөн систем админ хандах боломжтой' });
  }
  next();
};

// Worker authentication middleware
exports.workerAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Нэвтрэх шаардлагатай' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const worker = await Worker.findById(decoded.id)
      .populate('company');
    
    if (!worker) {
      return res.status(401).json({ message: 'Ажилтан олдсонгүй' });
    }

    req.worker = worker;
    next();
  } catch (error) {
    console.error('workerAuth - Error:', error.message);
    res.status(401).json({ message: 'Токен буруу эсвэл хугацаа дууссан' });
  }
};
