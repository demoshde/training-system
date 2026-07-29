const express = require('express');
const Worker = require('../models/Worker');
const Enrollment = require('../models/Enrollment');
const Certificate = require('../models/Certificate');
const SupervisorFeedback = require('../models/SupervisorFeedback');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// Check worker by SAP ID (public endpoint for supervisors)
router.get('/check/:sapId', async (req, res) => {
  try {
    const worker = await Worker.findOne({ sapId: req.params.sapId })
      .populate('company');
    
    if (!worker) {
      return res.status(404).json({ message: 'Ажилтан олдсонгүй' });
    }

    // Get all enrollments with training and certificate info
    const enrollments = await Enrollment.find({ worker: worker._id })
      .populate('training')
      .sort({ createdAt: -1 });
    
    const enrollmentsWithCerts = await Promise.all(enrollments.map(async (enrollment) => {
      const certificate = await Certificate.findOne({
        worker: worker._id,
        training: enrollment.training._id,
        status: 'active'
      });
      
      return {
        ...enrollment.toObject(),
        certificate: certificate ? {
          _id: certificate._id,
          certificateNumber: certificate.certificateNumber,
          issuedAt: certificate.issuedAt,
          expiresAt: certificate.expiresAt,
          isExpired: certificate.expiresAt && new Date() > certificate.expiresAt
        } : null
      };
    }));

    res.json({
      worker,
      enrollments: enrollmentsWithCerts
    });
  } catch (error) {
    console.error('Supervisor check error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Reset enrollment (for supervisor to re-enroll worker)
router.post('/reset/:enrollmentId', async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.enrollmentId)
      .populate({
        path: 'worker',
        populate: ['company']
      })
      .populate('training');

    if (!enrollment) {
      return res.status(404).json({ message: 'Бүртгэл олдсонгүй' });
    }

    // Reset enrollment
    enrollment.progress = 0;
    enrollment.currentSlide = 0;
    enrollment.isPassed = false;
    enrollment.score = null;
    enrollment.attempts = 0;
    enrollment.completedAt = null;
    await enrollment.save();

    // Revoke any active certificates
    await Certificate.updateMany(
      { 
        worker: enrollment.worker._id, 
        training: enrollment.training._id,
        status: 'active'
      },
      { status: 'revoked' }
    );

    res.json({ 
      message: 'Сургалт дахин эхлүүлэхээр тохируулагдлаа'
    });
  } catch (error) {
    console.error('Supervisor reset error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Get feedback for a worker
router.get('/feedback/:workerId', async (req, res) => {
  try {
    const feedback = await SupervisorFeedback.find({ worker: req.params.workerId })
      .populate('training', 'title')
      .sort({ createdAt: -1 });
    
    res.json(feedback);
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Add feedback for a worker
router.post('/feedback', async (req, res) => {
  try {
    const { workerId, trainingId, comment, rating } = req.body;

    if (!workerId || !rating) {
      return res.status(400).json({ message: 'Ажилтан болон үнэлгээ шаардлагатай' });
    }

    const feedback = await SupervisorFeedback.create({
      worker: workerId,
      training: trainingId || null,
      comment: comment || '',
      rating
    });

    const populatedFeedback = await SupervisorFeedback.findById(feedback._id)
      .populate('training', 'title');

    res.status(201).json(populatedFeedback);
  } catch (error) {
    console.error('Add feedback error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Delete feedback
router.delete('/feedback/:feedbackId', async (req, res) => {
  try {
    await SupervisorFeedback.findByIdAndDelete(req.params.feedbackId);
    res.json({ message: 'Сэтгэгдэл устгагдлаа' });
  } catch (error) {
    console.error('Delete feedback error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Get feedback summary for a worker (like/dislike counts)
router.get('/feedback-summary/:workerId', async (req, res) => {
  try {
    const likes = await SupervisorFeedback.countDocuments({ 
      worker: req.params.workerId, 
      rating: 'like' 
    });
    const dislikes = await SupervisorFeedback.countDocuments({ 
      worker: req.params.workerId, 
      rating: 'dislike' 
    });
    
    res.json({ likes, dislikes });
  } catch (error) {
    console.error('Get feedback summary error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

module.exports = router;
