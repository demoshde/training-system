const express = require('express');
const jwt = require('jsonwebtoken');
const Training = require('../models/Training');
const Worker = require('../models/Worker');
const Enrollment = require('../models/Enrollment');

const router = express.Router();

// GET /api/training-link/:trainingId — public info for the join page
router.get('/:trainingId', async (req, res) => {
  try {
    const training = await Training.findOne({ _id: req.params.trainingId, deletedAt: null });
    if (!training || !training.isActive) {
      return res.status(404).json({ message: 'Сургалт олдсонгүй эсвэл идэвхгүй байна' });
    }
    res.json({
      _id: training._id,
      title: training.title,
      description: training.description,
      slideCount: training.slides?.length || 0,
      questionCount: training.questions?.length || 0,
      passingScore: training.passingScore
    });
  } catch {
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

// POST /api/training-link/:trainingId/join — enter SAP, auto-enroll, get a worker token
router.post('/:trainingId/join', async (req, res) => {
  try {
    const { sapId } = req.body;
    if (!sapId || !sapId.trim()) {
      return res.status(400).json({ message: 'SAP дугаар шаардлагатай' });
    }
    const training = await Training.findOne({ _id: req.params.trainingId, deletedAt: null });
    if (!training || !training.isActive) {
      return res.status(404).json({ message: 'Сургалт олдсонгүй эсвэл идэвхгүй байна' });
    }

    const sap = sapId.trim();
    let worker = await Worker.findOne({ sapId: sap });
    if (!worker) {
      // Auto-create a minimal self-registered worker (admin can complete details later)
      worker = await Worker.create({
        sapId: sap,
        firstName: '',
        lastName: '',
        isSelfRegistered: true,
        isActive: true
      });
    }

    // Ensure an enrollment exists for this worker + training
    await Enrollment.findOneAndUpdate(
      { worker: worker._id, training: training._id },
      { $setOnInsert: { worker: worker._id, training: training._id } },
      { upsert: true, new: true }
    );

    const token = jwt.sign({ id: worker._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      worker: {
        _id: worker._id,
        sapId: worker.sapId,
        firstName: worker.firstName,
        lastName: worker.lastName,
        company: worker.company || null
      },
      trainingId: training._id
    });
  } catch (err) {
    console.error('Training link join error:', err.message);
    res.status(500).json({ message: err.message || 'Серверийн алдаа' });
  }
});

module.exports = router;
