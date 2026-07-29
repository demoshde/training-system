const express = require('express');
const Enrollment = require('../models/Enrollment');
const Certificate = require('../models/Certificate');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// Helper function to compute status from enrollment data
const computeStatus = (enrollment) => {
  if (enrollment.isPassed) {
    return 'completed';
  } else if (enrollment.score !== null && enrollment.score !== undefined && enrollment.score < (enrollment.training?.passingScore || 70)) {
    return 'failed';
  } else if (enrollment.progress > 0 || enrollment.currentSlide > 0) {
    return 'in_progress';
  }
  return 'enrolled';
};

// Add status to enrollment object
const addStatusToEnrollment = (enrollment) => {
  const obj = enrollment.toObject();
  obj.status = computeStatus(obj);
  return obj;
};

// Get all enrollments
router.get('/', adminAuth, async (req, res) => {
  try {
    const filter = {};
    
    // If company admin, only show enrollments for workers in their company
    if (req.admin.role !== 'super_admin') {
      // We need to filter by worker's company
      const enrollments = await Enrollment.find()
        .populate({
          path: 'worker',
          match: { company: req.admin.company._id },
          populate: ['company']
        })
        .populate('training')
        .sort({ createdAt: -1 });
      
      // Filter out null workers and deleted trainings
      const filtered = enrollments.filter(e => e.worker && e.training && !e.training.deletedAt);
      return res.json(filtered.map(addStatusToEnrollment));
    }

    const enrollments = await Enrollment.find()
      .populate({
        path: 'worker',
        populate: ['company']
      })
      .populate('training')
      .sort({ createdAt: -1 });
    
    // Filter out deleted trainings
    const filtered = enrollments.filter(e => e.training && !e.training.deletedAt);
    res.json(filtered.map(addStatusToEnrollment));
  } catch (error) {
    console.error('Get enrollments error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Create enrollment
router.post('/', adminAuth, async (req, res) => {
  try {
    const { worker, training } = req.body;
    
    // Validate required fields
    if (!worker || !training) {
      return res.status(400).json({ message: 'Ажилтан болон сургалт сонгоно уу' });
    }

    // Check if training exists and is active
    const Training = require('../models/Training');
    const trainingDoc = await Training.findById(training);
    if (!trainingDoc) {
      return res.status(404).json({ message: 'Сургалт олдсонгүй' });
    }
    if (!trainingDoc.isActive) {
      return res.status(400).json({ message: 'Сургалт идэвхгүй байна' });
    }

    // Check if worker exists
    const Worker = require('../models/Worker');
    const workerDoc = await Worker.findById(worker);
    if (!workerDoc) {
      return res.status(404).json({ message: 'Ажилтан олдсонгүй' });
    }

    // Check if enrollment already exists
    const existingEnrollment = await Enrollment.findOne({ worker, training });
    if (existingEnrollment) {
      // Check if certificate is expired - allow re-enrollment
      const certificate = await Certificate.findOne({ 
        worker, 
        training, 
        status: 'active' 
      });
      
      if (certificate) {
        const isExpired = certificate.expiresAt && new Date() > certificate.expiresAt;
        
        if (isExpired) {
          // Certificate is expired - reset enrollment and delete old certificate
          existingEnrollment.progress = 0;
          existingEnrollment.slidesViewed = [];
          existingEnrollment.attempts = 0;
          existingEnrollment.isPassed = false;
          existingEnrollment.completedAt = null;
          await existingEnrollment.save();
          
          // Revoke the old certificate
          certificate.status = 'revoked';
          await certificate.save();
          
          const populatedEnrollment = await Enrollment.findById(existingEnrollment._id)
            .populate({
              path: 'worker',
              populate: ['company']
            })
            .populate('training');
          
          return res.status(201).json(populatedEnrollment);
        }
      }
      
      return res.status(400).json({ message: 'Энэ ажилтан энэ сургалтанд бүртгэлтэй байна' });
    }

    const enrollment = await Enrollment.create({ worker, training });

    const populatedEnrollment = await Enrollment.findById(enrollment._id)
      .populate({
        path: 'worker',
        populate: ['company']
      })
      .populate('training');

    res.status(201).json(populatedEnrollment);
  } catch (error) {
    console.error('Create enrollment error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Delete enrollment
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const enrollment = await Enrollment.findByIdAndDelete(req.params.id);
    if (!enrollment) {
      return res.status(404).json({ message: 'Бүртгэл олдсонгүй' });
    }
    res.json({ message: 'Бүртгэл устгагдлаа' });
  } catch (error) {
    console.error('Delete enrollment error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Bulk check - get training progress for multiple SAP IDs
router.post('/bulk-check', adminAuth, async (req, res) => {
  try {
    const { sapIds, trainingId } = req.body;
    
    if (!sapIds || sapIds.length === 0) {
      return res.status(400).json({ message: 'SAP дугаар оруулна уу' });
    }

    const Worker = require('../models/Worker');
    
    // Find workers by SAP IDs
    const workers = await Worker.find({ 
      sapId: { $in: sapIds.map(id => id.trim().toUpperCase()) }
    }).populate('company');

    // Build filter for enrollments
    const workerIds = workers.map(w => w._id);
    const enrollmentFilter = { worker: { $in: workerIds } };
    
    if (trainingId) {
      enrollmentFilter.training = trainingId;
    }

    // Get enrollments for these workers
    const enrollments = await Enrollment.find(enrollmentFilter)
      .populate({
        path: 'worker',
        populate: ['company']
      })
      .populate('training')
      .sort({ createdAt: -1 });

    // Filter out deleted trainings
    const filtered = enrollments.filter(e => e.training && !e.training.deletedAt);
    
    // Create a map for quick lookup
    const enrollmentMap = {};
    filtered.forEach(e => {
      const key = `${e.worker.sapId}_${e.training._id}`;
      enrollmentMap[key] = addStatusToEnrollment(e);
    });

    // Build response with all SAP IDs (including those not found)
    const results = sapIds.map(sapId => {
      const normalizedSapId = sapId.trim().toUpperCase();
      const worker = workers.find(w => w.sapId === normalizedSapId);
      
      if (!worker) {
        return {
          sapId: normalizedSapId,
          found: false,
          worker: null,
          enrollments: []
        };
      }

      // Get all enrollments for this worker (filtered by training if specified)
      const workerEnrollments = filtered
        .filter(e => e.worker.sapId === normalizedSapId)
        .map(addStatusToEnrollment);

      return {
        sapId: normalizedSapId,
        found: true,
        worker: {
          _id: worker._id,
          firstName: worker.firstName,
          lastName: worker.lastName,
          sapId: worker.sapId,
          company: worker.company,
          helmetColor: worker.helmetColor
        },
        enrollments: workerEnrollments
      };
    });

    res.json({
      total: sapIds.length,
      found: results.filter(r => r.found).length,
      notFound: results.filter(r => !r.found).length,
      results
    });
  } catch (error) {
    console.error('Bulk check error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Bulk enrollment - enroll multiple workers to a training
router.post('/bulk', adminAuth, async (req, res) => {
  try {
    const { training, workers } = req.body;
    
    if (!training || !workers || workers.length === 0) {
      return res.status(400).json({ message: 'Сургалт болон ажилтан сонгоно уу' });
    }

    const results = {
      success: [],
      skipped: [],
      errors: []
    };

    for (const workerId of workers) {
      try {
        // Check if enrollment already exists
        const existingEnrollment = await Enrollment.findOne({ worker: workerId, training });
        
        if (existingEnrollment) {
          // Check if certificate is expired
          const certificate = await Certificate.findOne({ 
            worker: workerId, 
            training, 
            status: 'active' 
          });
          
          if (certificate) {
            const isExpired = certificate.expiresAt && new Date() > certificate.expiresAt;
            
            if (isExpired) {
              // Reset enrollment for expired certificate
              existingEnrollment.progress = 0;
              existingEnrollment.currentSlide = 0;
              existingEnrollment.slidesViewed = [];
              existingEnrollment.attempts = 0;
              existingEnrollment.isPassed = false;
              existingEnrollment.score = null;
              existingEnrollment.completedAt = null;
              await existingEnrollment.save();
              
              certificate.status = 'revoked';
              await certificate.save();
              
              results.success.push(workerId);
            } else {
              results.skipped.push({ workerId, reason: 'already_enrolled_active' });
            }
          } else {
            results.skipped.push({ workerId, reason: 'already_enrolled' });
          }
        } else {
          // Create new enrollment
          await Enrollment.create({ worker: workerId, training });
          results.success.push(workerId);
        }
      } catch (err) {
        results.errors.push({ workerId, error: err.message });
      }
    }

    res.status(201).json({
      message: `${results.success.length} ажилтан бүртгэгдлээ`,
      results
    });
  } catch (error) {
    console.error('Bulk enrollment error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Reset enrollment (for supervisor to re-enroll worker)
router.post('/:id/reset', adminAuth, async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id)
      .populate({
        path: 'worker',
        populate: ['company']
      })
      .populate('training');

    if (!enrollment) {
      return res.status(404).json({ message: 'Бүртгэл олдсонгүй' });
    }

    // Check company access for non-super admins
    if (req.admin.role !== 'super_admin' && 
        enrollment.worker.company._id.toString() !== req.admin.company._id.toString()) {
      return res.status(403).json({ message: 'Энэ бүртгэлийг өөрчлөх эрхгүй' });
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
    const Certificate = require('../models/Certificate');
    await Certificate.updateMany(
      { 
        worker: enrollment.worker._id, 
        training: enrollment.training._id,
        status: 'active'
      },
      { status: 'revoked' }
    );

    // Add status to response
    const enrollmentObj = enrollment.toObject();
    enrollmentObj.status = 'enrolled';

    res.json({ 
      message: 'Сургалт дахин эхлүүлэхээр тохируулагдлаа',
      enrollment: enrollmentObj
    });
  } catch (error) {
    console.error('Reset enrollment error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

module.exports = router;
