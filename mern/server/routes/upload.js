const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// Ensure upload directories exist
const uploadDir = path.join(__dirname, '../uploads');
const imagesDir = path.join(uploadDir, 'images');
const pdfsDir = path.join(uploadDir, 'pdfs');
const pptDir = path.join(uploadDir, 'presentations');

[uploadDir, imagesDir, pdfsDir, pptDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// PowerPoint MIME types
const pptMimeTypes = [
  'application/vnd.ms-powerpoint', // .ppt
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/vnd.openxmlformats-officedocument.presentationml.slideshow' // .ppsx
];

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, imagesDir);
    } else if (file.mimetype === 'application/pdf') {
      cb(null, pdfsDir);
    } else if (pptMimeTypes.includes(file.mimetype)) {
      cb(null, pptDir);
    } else {
      cb(null, uploadDir);
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf' || pptMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images, PDF, and PowerPoint files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Upload image
router.post('/image', adminAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Файл оруулна уу' });
    }

    const imageUrl = `/uploads/images/${req.file.filename}`;
    res.json({ 
      success: true,
      url: imageUrl,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ message: 'Зураг хуулахад алдаа гарлаа' });
  }
});

// Upload PDF
router.post('/pdf', adminAuth, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Файл оруулна уу' });
    }

    const pdfUrl = `/uploads/pdfs/${req.file.filename}`;
    res.json({ 
      success: true,
      url: pdfUrl,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('PDF upload error:', error);
    res.status(500).json({ message: 'PDF хуулахад алдаа гарлаа' });
  }
});

// PowerPoint upload configuration
const pptUpload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.ppt', '.pptx', '.ppsx'].includes(ext) || pptMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PowerPoint files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit for presentations
  }
});

// Upload PowerPoint
router.post('/presentation', adminAuth, pptUpload.single('presentation'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Файл оруулна уу' });
    }

    const pptUrl = `/uploads/presentations/${req.file.filename}`;
    res.json({ 
      success: true,
      url: pptUrl,
      filename: req.file.filename,
      originalName: req.file.originalname
    });
  } catch (error) {
    console.error('PowerPoint upload error:', error);
    res.status(500).json({ message: 'PowerPoint файл хуулахад алдаа гарлаа' });
  }
});

module.exports = router;
