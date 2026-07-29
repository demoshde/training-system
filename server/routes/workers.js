const express = require('express');
const Worker = require('../models/Worker');
const Training = require('../models/Training');
const Enrollment = require('../models/Enrollment');
const Certificate = require('../models/Certificate');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get all workers
router.get('/', adminAuth, async (req, res) => {
  try {
    const filter = {};
    
    if (req.admin.role !== 'super_admin') {
      filter.company = req.admin.company._id;
    }

    const workers = await Worker.find(filter)
      .populate('company')
      .sort({ createdAt: -1 });
    
    res.json(workers);
  } catch (error) {
    console.error('Get workers error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Check worker by SAP ID (for supervisor quick check) - MUST be before /:id
router.get('/check/:sapId', adminAuth, async (req, res) => {
  try {
    const worker = await Worker.findOne({ sapId: req.params.sapId })
      .populate('company');
    
    if (!worker) {
      return res.status(404).json({ message: 'Ажилтан олдсонгүй' });
    }

    // Check company access for non-super admins
    if (req.admin.role !== 'super_admin' && 
        worker.company._id.toString() !== req.admin.company._id.toString()) {
      return res.status(403).json({ message: 'Энэ ажилтны мэдээллийг харах эрхгүй' });
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
    console.error('Check worker error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Get single worker
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const worker = await Worker.findById(req.params.id)
      .populate('company');
    
    if (!worker) {
      return res.status(404).json({ message: 'Ажилтан олдсонгүй' });
    }

    res.json(worker);
  } catch (error) {
    console.error('Get worker error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Create worker
router.post('/', adminAuth, async (req, res) => {
  try {
    const { sapId, firstName, lastName, company, position, birthDate, employmentDate, helmetColor } = req.body;
    
    // Check if SAP ID already exists
    const existingWorker = await Worker.findOne({ sapId });
    if (existingWorker) {
      return res.status(400).json({ message: 'Энэ SAP дугаар бүртгэлтэй байна' });
    }

    // Verify company access
    const workerCompany = req.admin.role === 'super_admin' ? company : req.admin.company._id;

    const worker = await Worker.create({
      sapId,
      firstName,
      lastName,
      company: workerCompany,
      position,
      birthDate: birthDate || undefined,
      employmentDate: employmentDate || undefined,
      helmetColor
    });

    const populatedWorker = await Worker.findById(worker._id)
      .populate('company');

    // Auto-enroll in mandatory trainings
    const mandatoryTrainings = await Training.find({ isMandatory: true, isActive: true });
    for (const training of mandatoryTrainings) {
      await Enrollment.create({ worker: worker._id, training: training._id });
    }

    res.status(201).json(populatedWorker);
  } catch (error) {
    console.error('Create worker error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Update worker
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { sapId, firstName, lastName, company, position, birthDate, employmentDate, helmetColor, isActive } = req.body;
    
    // Check SAP ID uniqueness
    const existingWorker = await Worker.findOne({ sapId, _id: { $ne: req.params.id } });
    if (existingWorker) {
      return res.status(400).json({ message: 'Энэ SAP дугаар өөр ажилтанд бүртгэлтэй байна' });
    }

    const worker = await Worker.findByIdAndUpdate(
      req.params.id,
      { 
        sapId, 
        firstName, 
        lastName, 
        company, 
        position, 
        birthDate: birthDate || undefined,
        employmentDate: employmentDate || undefined,
        helmetColor, 
        isActive 
      },
      { new: true }
    ).populate('company');
    
    if (!worker) {
      return res.status(404).json({ message: 'Ажилтан олдсонгүй' });
    }

    res.json(worker);
  } catch (error) {
    console.error('Update worker error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Delete worker
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const worker = await Worker.findById(req.params.id);
    
    if (!worker) {
      return res.status(404).json({ message: 'Ажилтан олдсонгүй' });
    }

    // Check company access for non-super admins
    if (req.admin.role !== 'super_admin' && 
        worker.company.toString() !== req.admin.company._id.toString()) {
      return res.status(403).json({ message: 'Энэ ажилтныг устгах эрхгүй' });
    }

    // Cascade delete related data
    const WorkerLogin = require('../models/WorkerLogin');
    const SupervisorFeedback = require('../models/SupervisorFeedback');
    const PollResponse = require('../models/PollResponse');

    await Promise.all([
      Enrollment.deleteMany({ worker: req.params.id }),
      Certificate.deleteMany({ worker: req.params.id }),
      WorkerLogin.deleteMany({ worker: req.params.id }),
      SupervisorFeedback.deleteMany({ worker: req.params.id }),
      PollResponse.deleteMany({ worker: req.params.id })
    ]);

    await Worker.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Ажилтан болон холбогдох бүх мэдээлэл устгагдлаа' });
  } catch (error) {
    console.error('Delete worker error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Get worker enrollments with progress
router.get('/:id/enrollments', adminAuth, async (req, res) => {
  try {
    const Certificate = require('../models/Certificate');
    
    const enrollments = await Enrollment.find({ worker: req.params.id })
      .populate('training')
      .sort({ createdAt: -1 });
    
    // Add certificate info to each enrollment
    const enrollmentsWithCerts = await Promise.all(enrollments.map(async (enrollment) => {
      const certificate = await Certificate.findOne({ 
        worker: req.params.id, 
        training: enrollment.training._id,
        status: 'active'
      });
      
      return {
        ...enrollment.toObject(),
        certificate: certificate ? {
          _id: certificate._id,
          certificateId: certificate.certificateId,
          issuedAt: certificate.issuedAt,
          expiresAt: certificate.expiresAt,
          isExpired: certificate.expiresAt && new Date() > certificate.expiresAt
        } : null
      };
    }));
    
    res.json(enrollmentsWithCerts);
  } catch (error) {
    console.error('Get worker enrollments error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

module.exports = router;
