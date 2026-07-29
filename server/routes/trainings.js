const express = require('express');
const Training = require('../models/Training');
const Certificate = require('../models/Certificate');
const Enrollment = require('../models/Enrollment');
const { adminAuth, superAdminOnly } = require('../middleware/auth');

const router = express.Router();

// Get all trainings
router.get('/', adminAuth, async (req, res) => {
  try {
    const { deleted } = req.query;
    let query = {};
    
    if (deleted === 'true') {
      // Get only deleted trainings (trash bin)
      query.deletedAt = { $ne: null };
    } else {
      // Get only active trainings (not deleted)
      query.deletedAt = null;
    }
    
    const trainings = await Training.find(query).sort({ createdAt: -1 });
    res.json(trainings);
  } catch (error) {
    console.error('Get trainings error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Get single training
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const training = await Training.findById(req.params.id);
    
    if (!training) {
      return res.status(404).json({ message: 'Сургалт олдсонгүй' });
    }

    res.json(training);
  } catch (error) {
    console.error('Get training error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Create training (super admin only)
router.post('/', adminAuth, superAdminOnly, async (req, res) => {
  try {
    const { title, description, passingScore, validityPeriod, isMandatory, isActive, slides, questions } = req.body;

    console.log('Creating training:', { title, description, passingScore, validityPeriod, isMandatory, isActive, slidesCount: slides?.length, questionsCount: questions?.length });

    const training = await Training.create({
      title,
      description,
      passingScore,
      validityPeriod: validityPeriod || 0,
      isMandatory: isMandatory || false,
      isActive,
      slides: slides || [],
      questions: questions || []
    });

    console.log('Training created:', training._id);
    res.status(201).json(training);
  } catch (error) {
    console.error('Create training error:', error.message);
    console.error('Full error:', error);
    res.status(500).json({ message: 'Серверийн алдаа: ' + error.message });
  }
});

// Update training (super admin only)
router.put('/:id', adminAuth, superAdminOnly, async (req, res) => {
  try {
    const { title, description, passingScore, validityPeriod, isMandatory, isActive, slides, questions } = req.body;
    
    const updateData = { title, description, passingScore, isActive };
    if (validityPeriod !== undefined) updateData.validityPeriod = validityPeriod;
    if (isMandatory !== undefined) updateData.isMandatory = isMandatory;
    if (slides !== undefined) updateData.slides = slides;
    if (questions !== undefined) updateData.questions = questions;

    const training = await Training.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    if (!training) {
      return res.status(404).json({ message: 'Сургалт олдсонгүй' });
    }

    // Update expiry dates for all active certificates of this training
    if (validityPeriod !== undefined) {
      const certificates = await Certificate.find({ 
        training: req.params.id, 
        status: 'active' 
      });
      
      for (const cert of certificates) {
        if (validityPeriod > 0) {
          // Calculate new expiry date from certificate issue date
          const expiresAt = new Date(cert.issuedAt);
          expiresAt.setMonth(expiresAt.getMonth() + validityPeriod);
          cert.expiresAt = expiresAt;
        } else {
          // No expiry (validityPeriod = 0 means never expires)
          cert.expiresAt = null;
        }
        await cert.save();
      }
    }

    res.json(training);
  } catch (error) {
    console.error('Update training error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Delete training (soft delete - move to trash) (super admin only)
router.delete('/:id', adminAuth, superAdminOnly, async (req, res) => {
  try {
    const training = await Training.findByIdAndUpdate(
      req.params.id,
      { deletedAt: new Date() },
      { new: true }
    );
    
    if (!training) {
      return res.status(404).json({ message: 'Сургалт олдсонгүй' });
    }
    
    res.json({ message: 'Сургалт хогийн саванд орлоо' });
  } catch (error) {
    console.error('Delete training error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Restore training from trash (super admin only)
router.post('/:id/restore', adminAuth, superAdminOnly, async (req, res) => {
  try {
    const training = await Training.findByIdAndUpdate(
      req.params.id,
      { deletedAt: null },
      { new: true }
    );
    
    if (!training) {
      return res.status(404).json({ message: 'Сургалт олдсонгүй' });
    }
    
    res.json({ message: 'Сургалт сэргээгдлээ', training });
  } catch (error) {
    console.error('Restore training error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Permanently delete training (super admin only)
router.delete('/:id/permanent', adminAuth, superAdminOnly, async (req, res) => {
  try {
    const training = await Training.findByIdAndDelete(req.params.id);
    
    if (!training) {
      return res.status(404).json({ message: 'Сургалт олдсонгүй' });
    }
    
    // Delete all enrollments for this training
    await Enrollment.deleteMany({ training: req.params.id });
    
    // Delete all certificates for this training
    await Certificate.deleteMany({ training: req.params.id });
    
    res.json({ message: 'Сургалт болон холбогдох бүртгэлүүд бүрмөсөн устгагдлаа' });
  } catch (error) {
    console.error('Permanent delete training error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Add slide to training (super admin only)
router.post('/:id/slides', adminAuth, superAdminOnly, async (req, res) => {
  try {
    const training = await Training.findById(req.params.id);
    if (!training) {
      return res.status(404).json({ message: 'Сургалт олдсонгүй' });
    }

    training.slides.push(req.body);
    await training.save();

    res.json(training);
  } catch (error) {
    console.error('Add slide error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Add question to training (super admin only)
router.post('/:id/questions', adminAuth, superAdminOnly, async (req, res) => {
  try {
    const training = await Training.findById(req.params.id);
    if (!training) {
      return res.status(404).json({ message: 'Сургалт олдсонгүй' });
    }

    training.questions.push(req.body);
    await training.save();

    res.json(training);
  } catch (error) {
    console.error('Add question error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

module.exports = router;
