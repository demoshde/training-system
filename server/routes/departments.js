const express = require('express');
const Department = require('../models/Department');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get departments (optionally filtered by company)
router.get('/', adminAuth, async (req, res) => {
  try {
    const filter = {};
    
    if (req.query.company) {
      filter.company = req.query.company;
    } else if (req.admin.role !== 'super_admin') {
      filter.company = req.admin.company._id;
    }

    const departments = await Department.find(filter).populate('company');
    res.json(departments);
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Create department
router.post('/', adminAuth, async (req, res) => {
  try {
    const { name, company, description } = req.body;
    
    // Verify company access
    if (req.admin.role !== 'super_admin' && company !== req.admin.company._id.toString()) {
      return res.status(403).json({ message: 'Энэ компанид хэлтэс нэмэх эрхгүй' });
    }

    const department = await Department.create({ name, company, description });
    res.status(201).json(department);
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Update department
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const department = await Department.findByIdAndUpdate(
      req.params.id,
      { name, description },
      { new: true }
    );
    
    if (!department) {
      return res.status(404).json({ message: 'Хэлтэс олдсонгүй' });
    }

    res.json(department);
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Delete department
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    await Department.findByIdAndDelete(req.params.id);
    res.json({ message: 'Хэлтэс устгагдлаа' });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

module.exports = router;
