const express = require('express');
const Company = require('../models/Company');
const Worker = require('../models/Worker');
const Training = require('../models/Training');
const Enrollment = require('../models/Enrollment');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get dashboard statistics
router.get('/', adminAuth, async (req, res) => {
  try {
    let companyFilter = {};
    let enrollmentFilter = {};

    // Check if admin has company (non-super admins should have company)
    const isCompanyAdmin = req.admin.role !== 'super_admin' && req.admin.company;

    if (isCompanyAdmin) {
      companyFilter = { _id: req.admin.company._id };
    }

    const companies = req.admin.role === 'super_admin' 
      ? await Company.countDocuments()
      : 1;

    const workers = await Worker.countDocuments(
      isCompanyAdmin ? { company: req.admin.company._id } : {}
    );

    const trainings = await Training.countDocuments({ isActive: true });

    // Get enrollments
    let enrollmentsQuery = Enrollment.find()
      .populate({
        path: 'worker',
        populate: ['company']
      })
      .populate('training')
      .sort({ createdAt: -1 });

    let enrollments = await enrollmentsQuery;

    // Filter by company if not super admin
    if (isCompanyAdmin) {
      enrollments = enrollments.filter(e => 
        e.worker && e.worker.company && 
        e.worker.company._id.toString() === req.admin.company._id.toString()
      );
    }

    const completedEnrollments = enrollments.filter(e => e.isPassed).length;
    const pendingEnrollments = enrollments.filter(e => !e.isPassed).length;

    // Get company progress stats
    const companyProgressMap = {};
    enrollments.forEach(e => {
      if (e.worker && e.worker.company) {
        const companyName = e.worker.company.name;
        if (!companyProgressMap[companyName]) {
          companyProgressMap[companyName] = { total: 0, completed: 0 };
        }
        companyProgressMap[companyName].total++;
        if (e.isPassed) {
          companyProgressMap[companyName].completed++;
        }
      }
    });
    
    const companyProgress = Object.entries(companyProgressMap).map(([name, data]) => ({
      name,
      total: data.total,
      completed: data.completed,
      percentage: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0
    }));

    // Get training progress stats with company breakdown
    const trainingProgressMap = {};
    enrollments.forEach(e => {
      if (e.training && e.worker && e.worker.company) {
        const trainingId = e.training._id.toString();
        const trainingTitle = e.training.title;
        const companyName = e.worker.company.name;
        
        if (!trainingProgressMap[trainingId]) {
          trainingProgressMap[trainingId] = { 
            title: trainingTitle, 
            total: 0, 
            completed: 0,
            companies: {}
          };
        }
        
        if (!trainingProgressMap[trainingId].companies[companyName]) {
          trainingProgressMap[trainingId].companies[companyName] = { total: 0, completed: 0 };
        }
        
        trainingProgressMap[trainingId].total++;
        trainingProgressMap[trainingId].companies[companyName].total++;
        
        if (e.isPassed) {
          trainingProgressMap[trainingId].completed++;
          trainingProgressMap[trainingId].companies[companyName].completed++;
        }
      }
    });
    
    const trainingProgress = Object.entries(trainingProgressMap).map(([id, data]) => ({
      id,
      title: data.title,
      total: data.total,
      completed: data.completed,
      percentage: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      companies: Object.entries(data.companies).map(([name, cData]) => ({
        name,
        total: cData.total,
        completed: cData.completed,
        percentage: cData.total > 0 ? Math.round((cData.completed / cData.total) * 100) : 0
      }))
    }));

    res.json({
      stats: {
        companies,
        workers,
        trainings,
        enrollments: enrollments.length,
        completedEnrollments,
        pendingEnrollments
      },
      companyProgress,
      trainingProgress,
      recentEnrollments: enrollments.slice(0, 10)
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// Get workers not enrolled in a specific training for a company
router.get('/not-enrolled', adminAuth, async (req, res) => {
  try {
    const { trainingId, companyName, page = 1, limit = 10 } = req.query;
    
    if (!trainingId || !companyName) {
      return res.status(400).json({ message: 'trainingId and companyName are required' });
    }

    // Find company by name
    const company = await Company.findOne({ name: companyName });
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Get all workers in the company
    const allWorkers = await Worker.find({ company: company._id });
    const workerIds = allWorkers.map(w => w._id);

    // Get workers who have COMPLETED (isPassed=true) this training
    const completedEnrollments = await Enrollment.find({
      training: trainingId,
      worker: { $in: workerIds },
      isPassed: true
    }).distinct('worker');

    // Filter workers who haven't completed (not enrolled OR enrolled but not passed)
    const notCompletedWorkers = allWorkers.filter(
      w => !completedEnrollments.some(cw => cw.toString() === w._id.toString())
    );

    // Pagination
    const total = notCompletedWorkers.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginatedWorkers = notCompletedWorkers.slice(startIndex, startIndex + parseInt(limit));

    res.json({
      workers: paginatedWorkers.map(w => ({
        _id: w._id,
        firstName: w.firstName,
        lastName: w.lastName,
        sapId: w.sapId,
        position: w.position
      })),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages
      }
    });
  } catch (error) {
    console.error('Not completed workers error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

module.exports = router;
