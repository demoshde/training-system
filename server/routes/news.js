const express = require('express');
const router = express.Router();
const News = require('../models/News');
const { adminAuth, workerAuth } = require('../middleware/auth');

// Get all news for admin (filtered by company)
router.get('/admin', adminAuth, async (req, res) => {
  try {
    const { category } = req.query;
    const filter = {};
    
    if (category) {
      filter.category = category;
    }
    
    // Company admin can only see their company's news + global news
    if (req.admin.role !== 'super_admin' && req.admin.company) {
      filter.$or = [
        { company: req.admin.company },
        { company: null }
      ];
    }
    
    const news = await News.find(filter)
      .populate('createdBy', 'fullName')
      .populate('company', 'name')
      .sort({ createdAt: -1 });
    
    res.json(news);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all news (for workers - filtered by their company)
router.get('/', workerAuth, async (req, res) => {
  try {
    const { category, active } = req.query;
    
    // Build base filter
    const filter = {};
    
    if (category) {
      filter.category = category;
    }
    if (active === 'true') {
      filter.isActive = true;
    }
    
    // Worker can only see their company's news + global news (company: null or doesn't exist)
    const workerCompanyId = req.worker.company?._id || req.worker.company;
    
    if (workerCompanyId) {
      filter.$or = [
        { company: workerCompanyId },
        { company: null },
        { company: { $exists: false } }
      ];
    } else {
      // Worker without company can only see global news
      filter.$or = [
        { company: null },
        { company: { $exists: false } }
      ];
    }
    
    const news = await News.find(filter)
      .populate('createdBy', 'fullName')
      .populate('company', 'name')
      .sort({ createdAt: -1 });
    
    res.json(news);
  } catch (error) {
    console.error('News fetch error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get single news
router.get('/:id', async (req, res) => {
  try {
    const news = await News.findById(req.params.id)
      .populate('createdBy', 'name');
    
    if (!news) {
      return res.status(404).json({ message: 'Мэдээ олдсонгүй' });
    }
    
    res.json(news);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create news (admin only)
router.post('/', adminAuth, async (req, res) => {
  try {
    const { title, content, category, isActive, imageUrl, pdfUrl, youtubeUrl, googleSlidesUrl, company } = req.body;
    
    // Company admin can only create news for their own company
    let newsCompany = null;
    if (req.admin.role === 'super_admin') {
      // Superadmin can set company or leave null for all companies
      newsCompany = company || null;
    } else {
      // Company admin must use their own company
      newsCompany = req.admin.company;
    }
    
    const news = new News({
      title,
      content,
      category,
      company: newsCompany,
      isActive: isActive !== undefined ? isActive : true,
      imageUrl: imageUrl || null,
      pdfUrl: pdfUrl || null,
      youtubeUrl: youtubeUrl || null,
      googleSlidesUrl: googleSlidesUrl || null,
      createdBy: req.admin._id
    });
    
    await news.save();
    await news.populate('createdBy', 'fullName');
    await news.populate('company', 'name');
    
    res.status(201).json(news);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update news (admin only)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { title, content, category, isActive, imageUrl, pdfUrl, youtubeUrl, googleSlidesUrl, company } = req.body;
    
    const existingNews = await News.findById(req.params.id);
    if (!existingNews) {
      return res.status(404).json({ message: 'Мэдээ олдсонгүй' });
    }
    
    // Company admin can only edit their own company's news
    if (req.admin.role !== 'super_admin') {
      const adminCompanyId = req.admin.company?._id?.toString() || req.admin.company?.toString();
      const newsCompanyId = existingNews.company?.toString();
      
      if (!newsCompanyId) {
        return res.status(403).json({ message: 'Та бүх компанийн мэдээг засах эрхгүй' });
      }
      if (newsCompanyId !== adminCompanyId) {
        return res.status(403).json({ message: 'Та зөвхөн өөрийн компанийн мэдээг засах боломжтой' });
      }
    }
    
    // Determine company for update
    let newsCompany = existingNews.company;
    if (req.admin.role === 'super_admin') {
      newsCompany = company !== undefined ? (company || null) : existingNews.company;
    }
    
    const news = await News.findByIdAndUpdate(
      req.params.id,
      { 
        title, 
        content, 
        category, 
        company: newsCompany,
        isActive,
        imageUrl: imageUrl || null,
        pdfUrl: pdfUrl || null,
        youtubeUrl: youtubeUrl || null,
        googleSlidesUrl: googleSlidesUrl || null
      },
      { new: true, runValidators: true }
    ).populate('createdBy', 'fullName').populate('company', 'name');
    
    res.json(news);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete news (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const existingNews = await News.findById(req.params.id);
    if (!existingNews) {
      return res.status(404).json({ message: 'Мэдээ олдсонгүй' });
    }
    
    // Company admin can only delete their own company's news
    if (req.admin.role !== 'super_admin') {
      const adminCompanyId = req.admin.company?._id?.toString() || req.admin.company?.toString();
      const newsCompanyId = existingNews.company?.toString();
      
      if (!newsCompanyId) {
        return res.status(403).json({ message: 'Та бүх компанийн мэдээг устгах эрхгүй' });
      }
      if (newsCompanyId !== adminCompanyId) {
        return res.status(403).json({ message: 'Та зөвхөн өөрийн компанийн мэдээг устгах боломжтой' });
      }
    }
    
    await News.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Мэдээ устгагдлаа' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
