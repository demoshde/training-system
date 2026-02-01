const express = require('express');
const Enrollment = require('../models/Enrollment');
const Training = require('../models/Training');
const Certificate = require('../models/Certificate');
const Poll = require('../models/Poll');
const PollResponse = require('../models/PollResponse');
const { workerAuth } = require('../middleware/auth');

const router = express.Router();

// Get current worker profile (for token validation)
router.get('/me', workerAuth, async (req, res) => {
  try {
    res.json(req.worker);
  } catch (error) {
    console.error('Get worker profile error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Get worker's trainings
router.get('/trainings', workerAuth, async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ worker: req.worker._id })
      .populate('training')
      .sort({ createdAt: -1 });
    
    // Filter out inactive trainings and deleted trainings
    const activeEnrollments = enrollments.filter(e => 
      e.training && e.training.isActive && !e.training.deletedAt
    );
    
    // Get certificate expiry info for each enrollment
    const enrollmentsWithExpiry = await Promise.all(
      activeEnrollments.map(async (enrollment) => {
        const enrollmentObj = enrollment.toObject();
        
        if (enrollment.isPassed) {
          const certificate = await Certificate.findOne({
            worker: req.worker._id,
            training: enrollment.training._id
          });
          
          if (certificate) {
            enrollmentObj.certificateExpiresAt = certificate.expiresAt;
            enrollmentObj.certificateIsExpired = certificate.isExpired;
            enrollmentObj.certificateStatus = certificate.currentStatus;
          }
        }
        
        return enrollmentObj;
      })
    );
    
    res.json(enrollmentsWithExpiry);
  } catch (error) {
    console.error('Get worker trainings error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Get training details for worker
router.get('/trainings/:id', workerAuth, async (req, res) => {
  try {
    const enrollment = await Enrollment.findOne({
      worker: req.worker._id,
      training: req.params.id
    }).populate('training');

    if (!enrollment) {
      return res.status(404).json({ message: 'Бүртгэл олдсонгүй' });
    }

    const training = await Training.findById(req.params.id);
    
    // Don't send correct answers to client
    const questions = training.questions.map(q => ({
      _id: q._id,
      questionText: q.questionText,
      options: q.options.map(o => ({
        _id: o._id,
        text: o.text
      }))
    }));

    res.json({
      training,
      enrollment,
      questions
    });
  } catch (error) {
    console.error('Get training details error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Track slide progress
router.post('/trainings/:id/track', workerAuth, async (req, res) => {
  try {
    const { slideIndex } = req.body;
    
    const enrollment = await Enrollment.findOne({
      worker: req.worker._id,
      training: req.params.id
    });

    if (!enrollment) {
      return res.status(404).json({ message: 'Бүртгэл олдсонгүй' });
    }

    const training = await Training.findById(req.params.id);
    const totalSlides = training.slides.length;
    
    // Update current slide if it's further
    if (slideIndex >= enrollment.currentSlide) {
      enrollment.currentSlide = slideIndex;
      
      // Calculate progress (slides only, quiz is the final 100%)
      const slideProgress = Math.min(
        Math.round(((slideIndex + 1) / totalSlides) * 80), // Slides are 80% of progress
        80
      );
      enrollment.progress = slideProgress;
      
      await enrollment.save();
    }

    res.json({ success: true, progress: enrollment.progress });
  } catch (error) {
    console.error('Track slide error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Submit quiz
router.post('/trainings/:id/submit-quiz', workerAuth, async (req, res) => {
  try {
    const { answers } = req.body;
    
    const enrollment = await Enrollment.findOne({
      worker: req.worker._id,
      training: req.params.id
    });

    if (!enrollment) {
      return res.status(404).json({ message: 'Бүртгэл олдсонгүй' });
    }

    const training = await Training.findById(req.params.id);
    
    // Calculate score
    let correctCount = 0;
    for (const question of training.questions) {
      const userAnswerId = answers[question._id.toString()];
      const correctOption = question.options.find(o => o.isCorrect);
      
      if (correctOption && userAnswerId === correctOption._id.toString()) {
        correctCount++;
      }
    }

    const totalQuestions = training.questions.length;
    const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const passed = percentage >= training.passingScore;

    // Update enrollment
    enrollment.attempts += 1;
    enrollment.score = percentage;
    
    if (passed) {
      enrollment.isPassed = true;
      enrollment.progress = 100;
      enrollment.completedAt = new Date();
      
      // Create certificate if doesn't exist
      const existingCert = await Certificate.findOne({
        worker: req.worker._id,
        training: req.params.id
      });
      
      if (!existingCert) {
        // Calculate expiry date if training has validity period
        let expiresAt = null;
        if (training.validityPeriod && training.validityPeriod > 0) {
          expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + training.validityPeriod);
        }
        
        await Certificate.create({
          worker: req.worker._id,
          training: req.params.id,
          enrollment: enrollment._id,
          score: percentage,
          attempts: enrollment.attempts,
          issuedBy: 'Сургалтын систем',
          signature: 'Сургалтын менежер',
          expiresAt
        });
      }
    }
    
    await enrollment.save();

    res.json({
      score: correctCount,
      total: totalQuestions,
      percentage,
      passed,
      passingScore: training.passingScore
    });
  } catch (error) {
    console.error('Submit quiz error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Complete training without quiz (for trainings with no questions)
router.post('/trainings/:id/complete-without-quiz', workerAuth, async (req, res) => {
  try {
    const enrollment = await Enrollment.findOne({
      worker: req.worker._id,
      training: req.params.id
    });

    if (!enrollment) {
      return res.status(404).json({ message: 'Бүртгэл олдсонгүй' });
    }

    const training = await Training.findById(req.params.id);
    
    // Verify training has no questions
    if (training.questions && training.questions.length > 0) {
      return res.status(400).json({ message: 'Энэ сургалтанд шалгалт байна. Шалгалт өгнө үү.' });
    }

    // Mark as passed
    enrollment.isPassed = true;
    enrollment.progress = 100;
    enrollment.score = 100; // Full marks since no quiz
    enrollment.completedAt = new Date();
    enrollment.status = 'completed';
    
    await enrollment.save();

    // Create certificate if doesn't exist
    const existingCert = await Certificate.findOne({
      worker: req.worker._id,
      training: req.params.id
    });
    
    if (!existingCert) {
      // Calculate expiry date if training has validity period
      let expiresAt = null;
      if (training.validityPeriod && training.validityPeriod > 0) {
        expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + training.validityPeriod);
      }
      
      await Certificate.create({
        worker: req.worker._id,
        training: req.params.id,
        enrollment: enrollment._id,
        score: 100,
        attempts: 1,
        issuedBy: 'Сургалтын систем',
        signature: 'Сургалтын менежер',
        expiresAt
      });
    }

    res.json({
      success: true,
      message: 'Сургалт амжилттай дууслаа!'
    });
  } catch (error) {
    console.error('Complete without quiz error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Get certificate data
router.get('/trainings/:id/certificate', workerAuth, async (req, res) => {
  try {
    const enrollment = await Enrollment.findOne({
      worker: req.worker._id,
      training: req.params.id,
      isPassed: true
    }).populate('training');

    if (!enrollment) {
      return res.status(404).json({ message: 'Гэрчилгээ олдсонгүй. Та шалгалтанд тэнцээгүй байна.' });
    }

    // Find or create certificate
    let certificate = await Certificate.findOne({
      worker: req.worker._id,
      training: req.params.id
    }).populate('training').populate('worker');

    if (!certificate) {
      // Create certificate if it doesn't exist (for older completions)
      const training = enrollment.training;
      
      // Calculate expiry date if training has validity period
      let expiresAt = null;
      if (training.validityPeriod && training.validityPeriod > 0) {
        expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + training.validityPeriod);
      }
      
      certificate = await Certificate.create({
        worker: req.worker._id,
        training: req.params.id,
        enrollment: enrollment._id,
        score: enrollment.score,
        attempts: enrollment.attempts,
        issuedBy: 'Сургалтын систем',
        signature: 'Сургалтын менежер',
        expiresAt
      });
      certificate = await Certificate.findById(certificate._id)
        .populate('training')
        .populate('worker');
    }

    res.json({
      certificateNumber: certificate.certificateNumber,
      training: enrollment.training,
      company: req.worker.company,
      position: req.worker.position,
      score: enrollment.score,
      attempts: enrollment.attempts,
      completedAt: enrollment.completedAt,
      issuedAt: certificate.issuedAt,
      issuedBy: certificate.issuedBy,
      signature: certificate.signature,
      expiresAt: certificate.expiresAt,
      isExpired: certificate.isExpired,
      currentStatus: certificate.currentStatus,
      isValid: certificate.isValid
    });
  } catch (error) {
    console.error('Get certificate error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Re-enroll for expired training
router.post('/trainings/:id/re-enroll', workerAuth, async (req, res) => {
  try {
    const trainingId = req.params.id;
    const workerId = req.worker._id;

    // Find existing enrollment
    const enrollment = await Enrollment.findOne({ 
      worker: workerId, 
      training: trainingId 
    });
    
    if (!enrollment) {
      return res.status(404).json({ message: 'Бүртгэл олдсонгүй' });
    }

    // Find active certificate
    const certificate = await Certificate.findOne({
      worker: workerId,
      training: trainingId,
      status: 'active'
    });

    if (!certificate) {
      return res.status(400).json({ message: 'Сертификат олдсонгүй' });
    }

    // Check if certificate is expired
    const isExpired = certificate.expiresAt && new Date() > certificate.expiresAt;
    
    if (!isExpired) {
      return res.status(400).json({ message: 'Сертификатын хугацаа дуусаагүй байна' });
    }

    // Reset enrollment progress
    enrollment.progress = 0;
    enrollment.slidesViewed = [];
    enrollment.attempts = 0;
    enrollment.isPassed = false;
    enrollment.completedAt = null;
    await enrollment.save();

    // Revoke old certificate
    certificate.status = 'revoked';
    await certificate.save();

    res.json({ message: 'Дахин бүртгэл амжилттай', enrollment });
  } catch (error) {
    console.error('Re-enroll error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// ========== POLL ROUTES ==========

// Get available polls for worker
router.get('/polls', workerAuth, async (req, res) => {
  try {
    const now = new Date();
    
    // Get polls that are active and either for all or for worker's company
    const polls = await Poll.find({
      isActive: true,
      $and: [
        {
          $or: [
            { targetAudience: 'all' },
            { company: req.worker.company }
          ]
        },
        {
          $or: [
            { endDate: null },
            { endDate: { $gte: now } }
          ]
        }
      ],
      startDate: { $lte: now }
    }).select('title description questions isAnonymous startDate endDate');
    
    // Check which polls the worker has already responded to
    const responses = await PollResponse.find({
      worker: req.worker._id,
      poll: { $in: polls.map(p => p._id) }
    }).select('poll');
    
    const respondedPollIds = responses.map(r => r.poll.toString());
    
    const pollsWithStatus = polls.map(poll => ({
      ...poll.toObject(),
      hasResponded: respondedPollIds.includes(poll._id.toString())
    }));
    
    res.json(pollsWithStatus);
  } catch (error) {
    console.error('Get polls error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Get single poll
router.get('/polls/:id', workerAuth, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    
    if (!poll || !poll.isActive) {
      return res.status(404).json({ message: 'Санал асуулга олдсонгүй' });
    }
    
    // Check if worker has already responded
    const existingResponse = await PollResponse.findOne({
      poll: poll._id,
      worker: req.worker._id
    });
    
    res.json({
      poll,
      hasResponded: !!existingResponse,
      response: existingResponse
    });
  } catch (error) {
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Submit poll response
router.post('/polls/:id/respond', workerAuth, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    
    if (!poll || !poll.isActive) {
      return res.status(404).json({ message: 'Санал асуулга олдсонгүй' });
    }
    
    // Check if already responded
    const existingResponse = await PollResponse.findOne({
      poll: poll._id,
      worker: req.worker._id
    });
    
    if (existingResponse) {
      return res.status(400).json({ message: 'Та энэ санал асуулгад хариулсан байна' });
    }
    
    // Validate required questions
    const { answers } = req.body;
    for (let i = 0; i < poll.questions.length; i++) {
      const q = poll.questions[i];
      if (q.required) {
        const answer = answers.find(a => a.questionIndex === i);
        if (!answer || answer.answer === '' || answer.answer === null || 
            (Array.isArray(answer.answer) && answer.answer.length === 0)) {
          return res.status(400).json({ 
            message: `"${q.questionText}" асуултад хариулна уу` 
          });
        }
      }
    }
    
    const response = new PollResponse({
      poll: poll._id,
      worker: req.worker._id,
      answers: answers.map(a => ({
        ...a,
        questionText: poll.questions[a.questionIndex]?.questionText
      }))
    });
    
    await response.save();
    
    res.status(201).json({ message: 'Хариулт амжилттай илгээгдлээ', response });
  } catch (error) {
    console.error('Submit poll response error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

module.exports = router;
