const express = require('express');
const router = express.Router();
const Regulation = require('../models/Regulation');
const { adminAuth, superAdminOnly, workerAuth } = require('../middleware/auth');

// Get all regulations for admin
router.get('/admin', adminAuth, async (req, res) => {
  try {
    const regulations = await Regulation.find()
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 });
    res.json(regulations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all active regulations for workers
router.get('/', workerAuth, async (req, res) => {
  try {
    const regulations = await Regulation.find({ isActive: true })
      .select('regulationNumber title description pdfUrl category createdAt')
      .sort({ createdAt: -1 });
    res.json(regulations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single regulation
router.get('/:id', async (req, res) => {
  try {
    const regulation = await Regulation.findById(req.params.id)
      .populate('createdBy', 'fullName');
    
    if (!regulation) {
      return res.status(404).json({ message: 'Журам олдсонгүй' });
    }
    
    res.json(regulation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create regulation (superadmin only)
router.post('/', adminAuth, superAdminOnly, async (req, res) => {
  try {
    const { regulationNumber, title, description, pdfUrl, category, isActive } = req.body;
    
    if (!regulationNumber) {
      return res.status(400).json({ message: 'Журмын дугаар шаардлагатай' });
    }
    
    if (!pdfUrl) {
      return res.status(400).json({ message: 'PDF файл шаардлагатай' });
    }
    
    const regulation = new Regulation({
      regulationNumber,
      title,
      description,
      pdfUrl,
      category: category || 'other',
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.admin._id
    });
    
    await regulation.save();
    await regulation.populate('createdBy', 'fullName');
    
    res.status(201).json(regulation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update regulation (superadmin only)
router.put('/:id', adminAuth, superAdminOnly, async (req, res) => {
  try {
    const { regulationNumber, title, description, pdfUrl, category, isActive } = req.body;
    
    const regulation = await Regulation.findByIdAndUpdate(
      req.params.id,
      { regulationNumber, title, description, pdfUrl, category, isActive },
      { new: true, runValidators: true }
    ).populate('createdBy', 'fullName');
    
    if (!regulation) {
      return res.status(404).json({ message: 'Журам олдсонгүй' });
    }
    
    res.json(regulation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete regulation (superadmin only)
router.delete('/:id', adminAuth, superAdminOnly, async (req, res) => {
  try {
    const regulation = await Regulation.findByIdAndDelete(req.params.id);
    
    if (!regulation) {
      return res.status(404).json({ message: 'Журам олдсонгүй' });
    }
    
    res.json({ message: 'Журам устгагдлаа' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
