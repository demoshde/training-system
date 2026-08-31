const express = require('express');
const router  = express.Router();
const Worker  = require('../models/Worker');
const PVTTest = require('../models/PVTTest');
const PVTAlert= require('../models/PVTAlert');
const PvtSettings = require('../models/PvtSettings');
const { adminAuth, workerAuth, superAdminOnly } = require('../middleware/auth');

// ─── Scoring helper ────────────────────────────
function computeStatus(s1Pass, s2Pass, meanRT, lapses, falseStarts, s) {
  if ((!s1Pass && !s2Pass) || meanRT >= s.meanRtFail || lapses >= s.maxLapses || falseStarts >= s.maxFalseStarts) return 'HIGH_RISK';
  return 'LOW_RISK';
}

// ── POST /api/pvt/tests  — worker submits their own test ─────────────────────
router.post('/tests', workerAuth, async (req, res) => {
  try {
    const { stage1, stage2, stage3, testShift } = req.body;

    if (!stage1 || !stage2 || !stage3) {
      return res.status(400).json({ message: 'Missing stage data' });
    }

    const { meanRT, lapses, falseStarts } = stage3;
    const settings = await PvtSettings.getSingleton();
    const overallStatus = computeStatus(stage1.passed, stage2.passed, meanRT, lapses, falseStarts, settings);
    const companyId = req.worker.company?._id ?? req.worker.company;
    if (!companyId) return res.status(400).json({ message: 'Worker has no company assigned.' });

    const test = await PVTTest.create({
      driver:     req.worker._id,
      company:    companyId,
      driverName: `${req.worker.firstName} ${req.worker.lastName}`,
      driverSap:  req.worker.sapId,
      testShift:  testShift || req.worker.shiftType || '',
      stage1, stage2, stage3, overallStatus
    });

    if (overallStatus === 'HIGH_RISK') {
      await PVTAlert.create({
        company:    companyId,
        driver:     req.worker._id,
        test:       test._id,
        driverName: `${req.worker.firstName} ${req.worker.lastName}`,
        driverSap:  req.worker.sapId
      });
    }

    res.status(201).json({ testId: test._id, overallStatus });
  } catch (err) {
    console.error('PVT test submission error:', err.message, err.stack);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// ── POST /api/pvt/tests/guest  — anyone can take the test with just a SAP number ──
router.post('/tests/guest', async (req, res) => {
  try {
    const { sapId, stage1, stage2, stage3, testShift } = req.body;
    if (!sapId || !sapId.trim()) return res.status(400).json({ message: 'SAP дугаар шаардлагатай' });
    if (!stage1 || !stage2 || !stage3) return res.status(400).json({ message: 'Missing stage data' });

    const { meanRT, lapses, falseStarts } = stage3;
    const settings = await PvtSettings.getSingleton();
    const overallStatus = computeStatus(stage1.passed, stage2.passed, meanRT, lapses, falseStarts, settings);

    // Attach worker/company if this SAP happens to be registered
    const worker = await Worker.findOne({ sapId: sapId.trim() }).populate('company');
    const companyId = worker ? (worker.company?._id ?? worker.company) : undefined;

    const test = await PVTTest.create({
      driver:     worker?._id,
      company:    companyId,
      driverName: worker ? `${worker.firstName} ${worker.lastName}` : '',
      driverSap:  sapId.trim(),
      testShift:  testShift || worker?.shiftType || '',
      stage1, stage2, stage3, overallStatus
    });

    if (overallStatus === 'HIGH_RISK' && companyId) {
      await PVTAlert.create({
        company:    companyId,
        driver:     worker._id,
        test:       test._id,
        driverName: `${worker.firstName} ${worker.lastName}`,
        driverSap:  sapId.trim()
      });
    }

    res.status(201).json({ testId: test._id, overallStatus });
  } catch (err) {
    console.error('Guest PVT test submission error:', err.message, err.stack);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// ── GET /api/pvt/tests/my  — worker sees own history ─────────────────────────
router.get('/tests/my', workerAuth, async (req, res) => {
  try {
    const tests = await PVTTest.find({ driver: req.worker._id })
      .sort({ testedAt: -1 }).limit(20);
    res.json(tests);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// ── GET /api/pvt/tests  — admin sees company (or global) history ──────────────
router.get('/tests', adminAuth, async (req, res) => {
  try {
    let filter = {};
    if (req.admin.role !== 'super_admin') {
      const cid = req.admin.company?._id || req.admin.company;
      if (!cid) return res.status(400).json({ message: 'Admin компанигуй байна' });
      filter = { company: cid };
    }
    const tests = await PVTTest.find(filter)
      .populate('driver', 'firstName lastName sapId shiftType')
      .populate('company', 'name')
      .sort({ testedAt: -1 }).limit(500);
    res.json(tests);
  } catch (err) {
    console.error('PVT tests fetch error:', err.message);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// ── GET /api/pvt/alerts  — admin sees unread alerts for their company ─────────
router.get('/alerts', adminAuth, async (req, res) => {
  try {
    const filter = req.admin.role === 'super_admin' ? {} : { company: req.admin.company._id };
    if (req.query.unread === 'true') filter.isRead = false;
    const alerts = await PVTAlert.find(filter).sort({ createdAt: -1 }).limit(50);
    res.json(alerts);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// ── PUT /api/pvt/alerts/read-all ─────────────────────────────────────────────
router.put('/alerts/read-all', adminAuth, async (req, res) => {
  try {
    const filter = req.admin.role === 'super_admin'
      ? { isRead: false }
      : { company: req.admin.company._id, isRead: false };
    await PVTAlert.updateMany(filter, { isRead: true });
    res.json({ ok: true });
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// ── PUT /api/pvt/alerts/:id/read ─────────────────────────────────────────────
router.put('/alerts/:id/read', adminAuth, async (req, res) => {
  try {
    const alert = await PVTAlert.findById(req.params.id);
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    if (req.admin.role !== 'super_admin' &&
        alert.company.toString() !== req.admin.company._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    alert.isRead = true; await alert.save();
    res.json({ ok: true });
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// ── GET /api/pvt/dashboard  — stats for admin ────────────────────────────────
router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const cf = req.admin.role === 'super_admin' ? {} : { company: req.admin.company._id };
    const today = new Date(); today.setHours(0,0,0,0);
    const [totalDrivers, testsToday, highRiskToday, unreadAlerts, last14Days] = await Promise.all([
      Worker.countDocuments({ ...cf, isActive: true }),
      PVTTest.countDocuments({ ...cf, testedAt: { $gte: today } }),
      PVTTest.countDocuments({ ...cf, overallStatus: 'HIGH_RISK', testedAt: { $gte: today } }),
      PVTAlert.countDocuments({ ...cf, isRead: false }),
      PVTTest.aggregate([
        { $match: { ...cf, testedAt: { $gte: new Date(Date.now() - 14*24*60*60*1000) } } },
        { $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$testedAt' } },
            total:    { $sum: 1 },
            avgRT:    { $avg: '$stage3.meanRT' },
            highRisk: { $sum: { $cond: [{ $eq: ['$overallStatus','HIGH_RISK'] }, 1, 0] } },
            lowRisk:  { $sum: { $cond: [{ $eq: ['$overallStatus','LOW_RISK'] },  1, 0] } }
        }},
        { $sort: { _id: 1 } }
      ])
    ]);
    res.json({ totalDrivers, testsToday, highRiskToday, unreadAlerts, last14Days });
  } catch(err) { res.status(500).json({ message: 'Server error' }); }
});

// ── GET /api/pvt/export  — CSV export ────────────────────────────────────────
router.get('/export', adminAuth, async (req, res) => {
  try {
    const filter = req.admin.role === 'super_admin' ? {} : { company: req.admin.company._id };
    const tests = await PVTTest.find(filter)
      .populate('driver', 'firstName lastName sapId shiftType logisticsTrack')
      .populate('company', 'name').sort({ testedAt: -1 });

    const rows = [
      ['Date','Driver','SAP','Company','Shift','Track','S1','S2','Mean RT','Median RT','Lapses','F.Starts','Status']
    ];
    tests.forEach(t => {
      const d = t.driver;
      rows.push([
        new Date(t.testedAt).toISOString().slice(0,16),
        d ? `${d.firstName} ${d.lastName}` : '', d?.sapId || '',
        t.company?.name || '', d?.shiftType || '', d?.logisticsTrack || '',
        t.stage1?.passed ? 'PASS' : 'FAIL', t.stage2?.passed ? 'PASS' : 'FAIL',
        t.stage3?.meanRT?.toFixed(1) || '', t.stage3?.medianRT?.toFixed(1) || '',
        t.stage3?.lapses ?? '', t.stage3?.falseStarts ?? '', t.overallStatus
      ]);
    });

    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="pvt-report.csv"');
    res.send(csv);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// ── GET /api/pvt/settings  — public (test client needs thresholds) ───────────
router.get('/settings', async (req, res) => {
  try {
    const s = await PvtSettings.getSingleton();
    res.json({
      meanRtFail: s.meanRtFail, lapseRt: s.lapseRt, maxLapses: s.maxLapses,
      falseStartRt: s.falseStartRt, maxFalseStarts: s.maxFalseStarts, normalRt: s.normalRt
    });
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// ── PUT /api/pvt/settings  — super admin updates thresholds ──────────────────
router.put('/settings', adminAuth, superAdminOnly, async (req, res) => {
  try {
    const s = await PvtSettings.getSingleton();
    const fields = ['meanRtFail','lapseRt','maxLapses','falseStartRt','maxFalseStarts','normalRt'];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        const n = Number(req.body[f]);
        if (!Number.isFinite(n) || n < 0) return res.status(400).json({ message: `Буруу утга: ${f}` });
        s[f] = n;
      }
    }
    await s.save();
    res.json({
      meanRtFail: s.meanRtFail, lapseRt: s.lapseRt, maxLapses: s.maxLapses,
      falseStartRt: s.falseStartRt, maxFalseStarts: s.maxFalseStarts, normalRt: s.normalRt
    });
  } catch (err) { res.status(500).json({ message: err.message || 'Server error' }); }
});

// ── GET /api/pvt/history/:driverSap  — a driver's test history (trend) ───────
router.get('/history/:driverSap', adminAuth, async (req, res) => {
  try {
    const filter = { driverSap: req.params.driverSap };
    if (req.admin.role !== 'super_admin') {
      filter.company = req.admin.company?._id || req.admin.company;
    }
    const tests = await PVTTest.find(filter)
      .select('testedAt overallStatus testShift stage1.passed stage2.passed stage3.meanRT stage3.medianRT stage3.lapses stage3.falseStarts driverName')
      .sort({ testedAt: 1 }).limit(200);
    res.json(tests);
  } catch (err) { res.status(500).json({ message: err.message || 'Server error' }); }
});

module.exports = router;
