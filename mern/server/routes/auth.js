const express = require('express');
const jwt = require('jsonwebtoken');
const Worker = require('../models/Worker');
const WorkerLogin = require('../models/WorkerLogin');

const router = express.Router();

// Worker login with SAP ID
router.post('/login', async (req, res) => {
  try {
    const { sapId } = req.body;
    
    if (!sapId) {
      return res.status(400).json({ message: 'SAP дугаар шаардлагатай' });
    }

    const worker = await Worker.findOne({ sapId, isActive: true })
      .populate('company');
    
    if (!worker) {
      return res.status(401).json({ message: 'SAP дугаар буруу байна' });
    }

    // Log the login
    await WorkerLogin.create({
      worker: worker._id,
      ipAddress: req.ip
    });

    const token = jwt.sign(
      { id: worker._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      worker: {
        _id: worker._id,
        sapId: worker.sapId,
        firstName: worker.firstName,
        lastName: worker.lastName,
        company: worker.company,
        position: worker.position
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
});

module.exports = router;
