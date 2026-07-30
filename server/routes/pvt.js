const express  = require('express');
const router   = express.Router();
const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');
const Admin    = require('../models/Admin');
const Company  = require('../models/Company');
const PVTDriver = require('../models/PVTDriver');
const PVTTest  = require('../models/PVTTest');
const PVTAlert = require('../models/PVTAlert');

// ─── Internal helpers ────────────────────────────────────────────────────────

const SECRET = () => process.env.JWT_SECRET;

function signPVT(payload, expiresIn = '12h') {
  return jwt.sign({ ...payload, type: 'pvt' }, SECRET(), { expiresIn });
}

// ─── Middleware ───────────────────────────────────────────────────────────────

function pvtAuth(req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, SECRET());
    if (decoded.type !== 'pvt') return res.status(401).json({ message: 'Invalid token type' });
    req.pvtUser = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Token invalid or expired' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.pvtUser?.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
}

const isSuperAdmin = [pvtAuth, requireRole('pvt_super_admin')];
const isModerator  = [pvtAuth, requireRole('pvt_moderator', 'pvt_super_admin')];
const isDriver     = [pvtAuth, requireRole('pvt_driver')];

// ─── Scoring helper (mirrors client logic) ───────────────────────────────────

function computeStatus(s1Pass, s2Pass, meanRT, lapses, falseStarts) {
  if ((!s1Pass && !s2Pass) || meanRT >= 500 || lapses >= 3 || falseStarts >= 2) return 'HIGH_RISK';
  if (s1Pass && s2Pass && meanRT < 350 && lapses === 0 && falseStarts === 0) return 'LOW_RISK';
  return 'MODERATE_RISK';
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/pvt/auth/lookup  — { sapNumber } → determine type
router.post('/auth/lookup', async (req, res) => {
  try {
    const sap = (req.body.sapNumber || '').trim().toUpperCase();
    if (!sap) return res.status(400).json({ message: 'SAP number required' });

    // Super admin
    if (sap === 'SAP-SUPER') {
      return res.json({ type: 'super_admin', requiresPassword: true });
    }

    // Company moderator
    const admin = await Admin.findOne({ pvtSapCode: sap, isActive: true }).populate('company');
    if (admin) {
      return res.json({
        type: 'moderator',
        requiresPassword: true,
        companyName: admin.company?.name || 'Unknown'
      });
    }

    // Driver
    const driver = await PVTDriver.findOne({ sapNumber: sap, isActive: true }).populate('company');
    if (driver) {
      return res.json({
        type: 'driver',
        requiresPassword: false,
        driverName: driver.fullName,
        companyName: driver.company?.name || 'Unknown'
      });
    }

    return res.status(404).json({ message: 'SAP number not found in the system.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/pvt/auth/login  — super_admin or moderator password login
router.post('/auth/login', async (req, res) => {
  try {
    const sap      = (req.body.sapNumber || '').trim().toUpperCase();
    const password = req.body.password || '';

    // Super admin
    if (sap === 'SAP-SUPER') {
      const superAdmin = await Admin.findOne({ role: 'super_admin', isActive: true });
      if (!superAdmin) return res.status(401).json({ message: 'No super admin configured' });
      const valid = await superAdmin.comparePassword(password);
      if (!valid) return res.status(401).json({ message: 'Invalid password' });

      const token = signPVT({ role: 'pvt_super_admin', adminId: superAdmin._id.toString() });
      return res.json({ token, role: 'pvt_super_admin', name: superAdmin.fullName });
    }

    // Moderator
    const admin = await Admin.findOne({ pvtSapCode: sap, isActive: true }).populate('company');
    if (!admin) return res.status(404).json({ message: 'Moderator not found' });

    const valid = await admin.comparePassword(password);
    if (!valid) return res.status(401).json({ message: 'Invalid password' });

    const token = signPVT({
      role: 'pvt_moderator',
      adminId: admin._id.toString(),
      companyId: admin.company._id.toString(),
      companyName: admin.company.name
    });
    return res.json({
      token,
      role: 'pvt_moderator',
      name: admin.fullName,
      companyId: admin.company._id,
      companyName: admin.company.name
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/pvt/auth/driver  — driver SAP (no password)
router.post('/auth/driver', async (req, res) => {
  try {
    const sap = (req.body.sapNumber || '').trim().toUpperCase();
    const driver = await PVTDriver.findOne({ sapNumber: sap, isActive: true }).populate('company');
    if (!driver) return res.status(404).json({ message: 'Driver not found' });

    const token = signPVT({
      role: 'pvt_driver',
      driverId: driver._id.toString(),
      sapNumber: driver.sapNumber,
      companyId: driver.company._id.toString()
    }, '2h');

    return res.json({
      token,
      role: 'pvt_driver',
      driverId: driver._id,
      driverName: driver.fullName,
      companyName: driver.company.name
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DRIVER CRUD  (moderators + super admin)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/pvt/drivers
router.get('/drivers', ...isModerator, async (req, res) => {
  try {
    const filter = req.pvtUser.role === 'pvt_super_admin'
      ? {}
      : { company: req.pvtUser.companyId };
    const drivers = await PVTDriver.find(filter).populate('company', 'name').sort({ createdAt: -1 });
    res.json(drivers);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// POST /api/pvt/drivers
router.post('/drivers', ...isModerator, async (req, res) => {
  try {
    const companyId = req.pvtUser.role === 'pvt_super_admin'
      ? req.body.companyId
      : req.pvtUser.companyId;

    const { sapNumber, fullName, age, shiftType, logisticsTrack, convoyConfig,
            accommodationUnit, roomCapacity } = req.body;

    const driver = await PVTDriver.create({
      sapNumber: sapNumber.trim().toUpperCase(),
      fullName, age, company: companyId,
      shiftType, logisticsTrack,
      convoyConfig: convoyConfig || '',
      accommodationUnit: accommodationUnit || '',
      roomCapacity: roomCapacity || 'Single'
    });
    await driver.populate('company', 'name');
    res.status(201).json(driver);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'SAP number already registered' });
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/pvt/drivers/:id
router.put('/drivers/:id', ...isModerator, async (req, res) => {
  try {
    const driver = await PVTDriver.findById(req.params.id);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });

    // Company isolation
    if (req.pvtUser.role !== 'pvt_super_admin' &&
        driver.company.toString() !== req.pvtUser.companyId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const fields = ['fullName','age','shiftType','logisticsTrack','convoyConfig',
                    'accommodationUnit','roomCapacity','isActive'];
    fields.forEach(f => { if (req.body[f] !== undefined) driver[f] = req.body[f]; });
    await driver.save();
    await driver.populate('company', 'name');
    res.json(driver);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// DELETE /api/pvt/drivers/:id
router.delete('/drivers/:id', ...isModerator, async (req, res) => {
  try {
    const driver = await PVTDriver.findById(req.params.id);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });
    if (req.pvtUser.role !== 'pvt_super_admin' &&
        driver.company.toString() !== req.pvtUser.companyId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    await driver.deleteOne();
    res.json({ message: 'Driver removed' });
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUBMISSION  (driver)
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/pvt/tests
router.post('/tests', ...isDriver, async (req, res) => {
  try {
    const { stage1, stage2, stage3 } = req.body;
    const { meanRT, lapses, falseStarts } = stage3;

    const overallStatus = computeStatus(
      stage1.passed, stage2.passed, meanRT, lapses, falseStarts
    );

    const test = await PVTTest.create({
      driver:  req.pvtUser.driverId,
      company: req.pvtUser.companyId,
      stage1, stage2, stage3,
      overallStatus
    });

    // Dispatch alert if HIGH_RISK
    if (overallStatus === 'HIGH_RISK') {
      const driver = await PVTDriver.findById(req.pvtUser.driverId);
      await PVTAlert.create({
        company:    req.pvtUser.companyId,
        driver:     req.pvtUser.driverId,
        test:       test._id,
        driverName: driver?.fullName || 'Unknown',
        driverSap:  req.pvtUser.sapNumber
      });
      await PVTTest.findByIdAndUpdate(test._id, { alertDispatched: true });
    }

    res.status(201).json({ testId: test._id, overallStatus });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST HISTORY  (moderator: own company | super admin: global)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/pvt/tests
router.get('/tests', ...isModerator, async (req, res) => {
  try {
    const filter = req.pvtUser.role === 'pvt_super_admin'
      ? {}
      : { company: req.pvtUser.companyId };

    if (req.query.track) {
      // filter by logisticsTrack via driver join (post-filter after populate)
    }

    const tests = await PVTTest.find(filter)
      .populate('driver', 'fullName sapNumber logisticsTrack shiftType')
      .populate('company', 'name')
      .sort({ testedAt: -1 })
      .limit(200);
    res.json(tests);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ALERTS  (moderator: own company)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/pvt/alerts
router.get('/alerts', ...isModerator, async (req, res) => {
  try {
    const filter = req.pvtUser.role === 'pvt_super_admin'
      ? {}
      : { company: req.pvtUser.companyId };
    if (req.query.unread === 'true') filter.isRead = false;

    const alerts = await PVTAlert.find(filter)
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(alerts);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// PUT /api/pvt/alerts/:id/read
router.put('/alerts/:id/read', ...isModerator, async (req, res) => {
  try {
    const alert = await PVTAlert.findById(req.params.id);
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    if (req.pvtUser.role !== 'pvt_super_admin' &&
        alert.company.toString() !== req.pvtUser.companyId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    alert.isRead = true;
    await alert.save();
    res.json({ ok: true });
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// PUT /api/pvt/alerts/read-all
router.put('/alerts/read-all', ...isModerator, async (req, res) => {
  try {
    const filter = req.pvtUser.role === 'pvt_super_admin'
      ? { isRead: false }
      : { company: req.pvtUser.companyId, isRead: false };
    await PVTAlert.updateMany(filter, { isRead: true });
    res.json({ ok: true });
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD STATS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/pvt/dashboard
router.get('/dashboard', ...isModerator, async (req, res) => {
  try {
    const companyFilter = req.pvtUser.role === 'pvt_super_admin'
      ? {}
      : { company: req.pvtUser.companyId };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalDrivers, testsToday, highRiskToday, unreadAlerts, last14Days] = await Promise.all([
      PVTDriver.countDocuments({ ...companyFilter }),
      PVTTest.countDocuments({ ...companyFilter, testedAt: { $gte: today } }),
      PVTTest.countDocuments({ ...companyFilter, overallStatus: 'HIGH_RISK', testedAt: { $gte: today } }),
      PVTAlert.countDocuments({ ...companyFilter, isRead: false }),
      // Daily trend for last 14 days
      PVTTest.aggregate([
        { $match: {
            ...companyFilter,
            testedAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) }
        }},
        { $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$testedAt' } },
            total: { $sum: 1 },
            avgRT: { $avg: '$stage3.meanRT' },
            highRisk: { $sum: { $cond: [{ $eq: ['$overallStatus', 'HIGH_RISK'] }, 1, 0] } },
            lowRisk:  { $sum: { $cond: [{ $eq: ['$overallStatus', 'LOW_RISK'] },  1, 0] } }
        }},
        { $sort: { _id: 1 } }
      ])
    ]);

    res.json({ totalDrivers, testsToday, highRiskToday, unreadAlerts, last14Days });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUPER ADMIN — COMPANY / MODERATOR MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/pvt/companies  — all companies + their assigned moderator pvtSapCode
router.get('/companies', ...isSuperAdmin, async (req, res) => {
  try {
    const companies = await Company.find().sort({ name: 1 });
    const admins = await Admin.find({ role: 'company_admin' })
      .select('fullName pvtSapCode company')
      .populate('company', 'name');

    const result = companies.map(c => {
      const mod = admins.find(a => a.company?._id.toString() === c._id.toString());
      return {
        _id: c._id,
        name: c.name,
        description: c.description,
        moderator: mod ? { name: mod.fullName, pvtSapCode: mod.pvtSapCode || null } : null
      };
    });
    res.json(result);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// PUT /api/pvt/companies/:companyId/moderator  — assign pvtSapCode to company admin
router.put('/companies/:companyId/moderator', ...isSuperAdmin, async (req, res) => {
  try {
    const { pvtSapCode } = req.body;
    if (!pvtSapCode) return res.status(400).json({ message: 'pvtSapCode required' });

    const sap = pvtSapCode.trim().toUpperCase();

    // Ensure unique
    const existing = await Admin.findOne({ pvtSapCode: sap });
    if (existing && existing.company?.toString() !== req.params.companyId) {
      return res.status(409).json({ message: 'That SAP code is already assigned to another moderator' });
    }

    const admin = await Admin.findOne({ company: req.params.companyId, role: 'company_admin' });
    if (!admin) return res.status(404).json({ message: 'No company admin found for this company' });

    admin.pvtSapCode = sap;
    await admin.save();
    res.json({ message: 'Moderator SAP code updated', pvtSapCode: sap });
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// GET /api/pvt/global-stats  — super admin overview
router.get('/global-stats', ...isSuperAdmin, async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const [totalTests, todayTests, highRisk, companies, drivers] = await Promise.all([
      PVTTest.countDocuments(),
      PVTTest.countDocuments({ testedAt: { $gte: today } }),
      PVTTest.countDocuments({ overallStatus: 'HIGH_RISK', testedAt: { $gte: today } }),
      Company.countDocuments(),
      PVTDriver.countDocuments({ isActive: true })
    ]);
    res.json({ totalTests, todayTests, highRisk, companies, drivers });
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CSV EXPORT  (moderator: own company)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/pvt/export
router.get('/export', ...isModerator, async (req, res) => {
  try {
    const filter = req.pvtUser.role === 'pvt_super_admin'
      ? {}
      : { company: req.pvtUser.companyId };

    const tests = await PVTTest.find(filter)
      .populate('driver', 'fullName sapNumber shiftType logisticsTrack')
      .populate('company', 'name')
      .sort({ testedAt: -1 });

    const rows = [
      ['Date','Driver Name','SAP','Company','Shift','Track','S1 Pass','S2 Pass',
       'Mean RT (ms)','Median RT (ms)','Lapses','False Starts','Overall Status']
    ];

    tests.forEach(t => {
      rows.push([
        new Date(t.testedAt).toISOString().slice(0,16),
        t.driver?.fullName || '', t.driver?.sapNumber || '',
        t.company?.name || '',
        t.driver?.shiftType || '', t.driver?.logisticsTrack || '',
        t.stage1?.passed ? 'PASS' : 'FAIL',
        t.stage2?.passed ? 'PASS' : 'FAIL',
        t.stage3?.meanRT?.toFixed(1) || '',
        t.stage3?.medianRT?.toFixed(1) || '',
        t.stage3?.lapses ?? '',
        t.stage3?.falseStarts ?? '',
        t.overallStatus
      ]);
    });

    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="pvt-report.csv"');
    res.send(csv);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
