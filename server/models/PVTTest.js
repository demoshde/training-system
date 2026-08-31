const mongoose = require('mongoose');

const trialSchema = new mongoose.Schema({
  reactionTime: Number,  // ms — null if false start during armed phase
  isFalseStart: Boolean, // clicked before green OR rt < 100ms
  isLapse:      Boolean  // rt >= 560ms
}, { _id: false });

const pvtTestSchema = new mongoose.Schema({
  driver:  { type: mongoose.Schema.Types.ObjectId, ref: 'Worker' },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  // Denormalized for reliable display even if worker is deleted
  driverName: { type: String, default: '' },
  driverSap:  { type: String, default: '' },
  testShift:  { type: String, default: '' },  // shift at time of test

  stage1: {
    shownSequence:   { type: String },
    enteredSequence: { type: String },
    passed:          { type: Boolean }
  },
  stage2: {
    shownNumber:     { type: String },
    enteredSequence: { type: String },
    passed:          { type: Boolean }
  },
  stage3: {
    trials:      [trialSchema],
    meanRT:      { type: Number },
    medianRT:    { type: Number },
    lapses:      { type: Number, default: 0 },
    falseStarts: { type: Number, default: 0 }
  },

  overallStatus: {
    type: String,
    enum: ['LOW_RISK', 'HIGH_RISK'],
    required: true
  },
  alertDispatched: { type: Boolean, default: false },
  testedAt:        { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('PVTTest', pvtTestSchema);
