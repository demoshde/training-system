const express = require('express');
const router = express.Router();
const News = require('../models/News');
const { adminAuth } = require('../middleware/auth');

// Get all news (public - for workers)
router.get('/', async (req, res) => {
  try {
    const { category, active } = req.query;
    const filter = {};
    
    if (category) {
      filter.category = category;
    }
    if (active === 'true') {
      filter.isActive = true;
    }
    
    const news = await News.find(filter)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    
    res.json(news);
  } catch (error) {
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
    const { title, content, category, isActive, imageUrl, pdfUrl, youtubeUrl, googleSlidesUrl } = req.body;
    
    const news = new News({
      title,
      content,
      category,
      isActive: isActive !== undefined ? isActive : true,
      imageUrl: imageUrl || null,
      pdfUrl: pdfUrl || null,
      youtubeUrl: youtubeUrl || null,
      googleSlidesUrl: googleSlidesUrl || null,
      createdBy: req.admin._id
    });
    
    await news.save();
    await news.populate('createdBy', 'name');
    
    res.status(201).json(news);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update news (admin only)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { title, content, category, isActive, imageUrl, pdfUrl, youtubeUrl, googleSlidesUrl } = req.body;
    
    const news = await News.findByIdAndUpdate(
      req.params.id,
      { 
        title, 
        content, 
        category, 
        isActive,
        imageUrl: imageUrl || null,
        pdfUrl: pdfUrl || null,
        youtubeUrl: youtubeUrl || null,
        googleSlidesUrl: googleSlidesUrl || null
      },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name');
    
    if (!news) {
      return res.status(404).json({ message: 'Мэдээ олдсонгүй' });
    }
    
    res.json(news);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete news (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const news = await News.findByIdAndDelete(req.params.id);
    
    if (!news) {
      return res.status(404).json({ message: 'Мэдээ олдсонгүй' });
    }
    
    res.json({ message: 'Мэдээ устгагдлаа' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
