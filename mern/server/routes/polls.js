const express = require('express');
const router = express.Router();
const Poll = require('../models/Poll');
const PollResponse = require('../models/PollResponse');
const Worker = require('../models/Worker');
const Company = require('../models/Company');
const { adminAuth, superAdminOnly } = require('../middleware/auth');

// Get all polls
router.get('/', adminAuth, async (req, res) => {
  try {
    const query = {};
    
    // Company admins can only see their company's polls or polls for all
    if (req.admin.role !== 'super_admin') {
      query.$or = [
        { company: req.admin.company },
        { targetAudience: 'all' }
      ];
    }
    
    const polls = await Poll.find(query)
      .populate('company', 'name')
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 });
    
    // Get response counts for each poll
    const pollsWithCounts = await Promise.all(polls.map(async (poll) => {
      const responseCount = await PollResponse.countDocuments({ poll: poll._id });
      return {
        ...poll.toObject(),
        responseCount
      };
    }));
    
    res.json(pollsWithCounts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single poll with responses
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id)
      .populate('company', 'name')
      .populate('createdBy', 'username');
    
    if (!poll) {
      return res.status(404).json({ message: 'Poll олдсонгүй' });
    }
    
    const responses = await PollResponse.find({ poll: poll._id })
      .populate('worker', 'firstName lastName company')
      .sort({ submittedAt: -1 });
    
    res.json({ poll, responses });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create poll
router.post('/', adminAuth, async (req, res) => {
  try {
    const poll = new Poll({
      ...req.body,
      createdBy: req.admin._id,
      company: req.admin.role === 'super_admin' ? req.body.company : req.admin.company
    });
    
    await poll.save();
    res.status(201).json(poll);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update poll
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    
    if (!poll) {
      return res.status(404).json({ message: 'Poll олдсонгүй' });
    }
    
    // Check permission
    if (req.admin.role !== 'super_admin' && 
        poll.createdBy?.toString() !== req.admin._id.toString()) {
      return res.status(403).json({ message: 'Зөвшөөрөлгүй' });
    }
    
    Object.assign(poll, req.body);
    await poll.save();
    
    res.json(poll);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete poll
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    
    if (!poll) {
      return res.status(404).json({ message: 'Poll олдсонгүй' });
    }
    
    // Check permission
    if (req.admin.role !== 'super_admin' && 
        poll.createdBy?.toString() !== req.admin._id.toString()) {
      return res.status(403).json({ message: 'Зөвшөөрөлгүй' });
    }
    
    // Delete all responses
    await PollResponse.deleteMany({ poll: poll._id });
    await poll.deleteOne();
    
    res.json({ message: 'Амжилттай устгалаа' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get poll statistics/summary
router.get('/:id/stats', adminAuth, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) {
      return res.status(404).json({ message: 'Poll олдсонгүй' });
    }
    
    const responses = await PollResponse.find({ poll: poll._id }).populate({
      path: 'worker',
      select: 'company'
    });
    
    // Get all companies for color mapping
    const Company = require('../models/Company');
    const companies = await Company.find({});
    const companyColorMap = {};
    const companyNameMap = {};
    const colors = ['blue', 'purple', 'emerald', 'orange', 'pink', 'cyan', 'amber', 'indigo', 'red', 'teal'];
    companies.forEach((c, idx) => {
      companyColorMap[c._id.toString()] = colors[idx % colors.length];
      companyNameMap[c._id.toString()] = c.name;
    });
    
    const stats = {
      totalResponses: responses.length,
      companyColors: companyColorMap,
      questions: poll.questions.map((q, idx) => {
        const questionStats = {
          questionText: q.questionText,
          questionType: q.questionType,
          responses: []
        };
        
        if (q.questionType === 'rating') {
          // Calculate average rating
          const ratings = responses
            .map(r => r.answers.find(a => a.questionIndex === idx)?.answer)
            .filter(a => a !== undefined && a !== null);
          
          questionStats.averageRating = ratings.length > 0 
            ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
            : 0;
          questionStats.ratingDistribution = [1, 2, 3, 4, 5].map(rating => ({
            rating,
            count: ratings.filter(r => r === rating).length
          }));
        } else if (q.questionType === 'single_choice' || q.questionType === 'multiple_choice') {
          // Count option selections with company breakdown
          const optionData = {};
          q.options.forEach(opt => {
            optionData[opt.text] = { total: 0, byCompany: {} };
          });
          
          responses.forEach(r => {
            const answer = r.answers.find(a => a.questionIndex === idx)?.answer;
            const companyId = r.worker?.company?.toString();
            
            if (Array.isArray(answer)) {
              answer.forEach(a => {
                if (optionData[a]) {
                  optionData[a].total++;
                  if (companyId) {
                    optionData[a].byCompany[companyId] = (optionData[a].byCompany[companyId] || 0) + 1;
                  }
                }
              });
            } else if (answer && optionData[answer]) {
              optionData[answer].total++;
              if (companyId) {
                optionData[answer].byCompany[companyId] = (optionData[answer].byCompany[companyId] || 0) + 1;
              }
            }
          });
          
          questionStats.optionCounts = Object.entries(optionData).map(([option, data]) => ({
            option,
            count: data.total,
            byCompany: Object.entries(data.byCompany).map(([companyId, count]) => ({
              companyId,
              companyName: companyNameMap[companyId] || 'Unknown',
              count,
              color: companyColorMap[companyId] || 'gray'
            }))
          }));
        } else {
          // Text responses
          questionStats.textResponses = responses
            .map(r => r.answers.find(a => a.questionIndex === idx)?.answer)
            .filter(a => a);
        }
        
        return questionStats;
      })
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get poll response rate by company
router.get('/:id/company-stats', adminAuth, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) {
      return res.status(404).json({ message: 'Poll олдсонгүй' });
    }
    
    // Get all companies
    let companies;
    if (poll.targetAudience === 'company' && poll.company) {
      companies = await Company.find({ _id: poll.company });
    } else {
      // Get all companies (no isActive filter since Company model doesn't have it)
      companies = await Company.find({});
    }
    
    // Get responses with worker info
    const responses = await PollResponse.find({ poll: poll._id })
      .populate('worker', 'company');
    
    // Calculate stats for each company
    const companyStats = await Promise.all(companies.map(async (company) => {
      // Count total workers in company (include workers where isActive is true or undefined)
      const totalWorkers = await Worker.countDocuments({ 
        company: company._id,
        $or: [{ isActive: true }, { isActive: { $exists: false } }]
      });
      
      // Count responses from this company
      const companyResponses = responses.filter(r => 
        r.worker?.company?.toString() === company._id.toString()
      ).length;
      
      const responseRate = totalWorkers > 0 
        ? Math.round((companyResponses / totalWorkers) * 100) 
        : 0;
      
      return {
        companyId: company._id,
        companyName: company.name,
        totalWorkers,
        responses: companyResponses,
        responseRate
      };
    }));
    
    // Filter out companies with 0 workers
    const activeCompanyStats = companyStats.filter(c => c.totalWorkers > 0);
    
    // Sort by response rate descending
    activeCompanyStats.sort((a, b) => b.responseRate - a.responseRate);
    
    // Calculate overall stats
    const totalWorkers = activeCompanyStats.reduce((sum, c) => sum + c.totalWorkers, 0);
    const totalResponses = responses.length;
    const overallRate = totalWorkers > 0 
      ? Math.round((totalResponses / totalWorkers) * 100) 
      : 0;
    
    res.json({
      poll: {
        _id: poll._id,
        title: poll.title,
        targetAudience: poll.targetAudience
      },
      overall: {
        totalWorkers,
        totalResponses,
        responseRate: overallRate
      },
      companies: activeCompanyStats
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
