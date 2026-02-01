const express = require('express');
const Company = require('../models/Company');
const Worker = require('../models/Worker');
const { adminAuth, superAdminOnly } = require('../middleware/auth');

const router = express.Router();

// Get all companies (with worker count)
router.get('/', adminAuth, async (req, res) => {
  try {
    let companies;
    if (req.admin.role === 'super_admin') {
      companies = await Company.find().lean();
    } else {
      companies = await Company.find({ _id: req.admin.company._id }).lean();
    }

    // Get counts
    for (let company of companies) {
      company.workerCount = await Worker.countDocuments({ company: company._id });
    }

    res.json(companies);
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Create company (super admin only)
router.post('/', adminAuth, superAdminOnly, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const existingCompany = await Company.findOne({ name });
    if (existingCompany) {
      return res.status(400).json({ message: 'Энэ нэртэй компани бүртгэлтэй байна' });
    }

    const company = await Company.create({ name, description });
    res.status(201).json(company);
  } catch (error) {
    console.error('Create company error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Update company (super admin only)
router.put('/:id', adminAuth, superAdminOnly, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { name, description },
      { new: true }
    );
    
    if (!company) {
      return res.status(404).json({ message: 'Компани олдсонгүй' });
    }

    res.json(company);
  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Delete company (super admin only)
router.delete('/:id', adminAuth, superAdminOnly, async (req, res) => {
  try {
    const workerCount = await Worker.countDocuments({ company: req.params.id });
    if (workerCount > 0) {
      return res.status(400).json({ message: 'Энэ компанид ажилтан бүртгэлтэй байна. Эхлээд ажилтнуудыг устгана уу.' });
    }

    await Company.findByIdAndDelete(req.params.id);
    res.json({ message: 'Компани устгагдлаа' });
  } catch (error) {
    console.error('Delete company error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

module.exports = router;
