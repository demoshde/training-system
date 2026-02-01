const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
  worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  training: { type: mongoose.Schema.Types.ObjectId, ref: 'Training', required: true },
  progress: { type: Number, default: 0 },
  currentSlide: { type: Number, default: 0 },
  slidesViewed: [{ type: Number }], // Array of viewed slide indices
  isPassed: { type: Boolean, default: false },
  score: { type: Number },
  attempts: { type: Number, default: 0 },
  completedAt: { type: Date }
}, { timestamps: true });

// Ensure one enrollment per worker-training combination
enrollmentSchema.index({ worker: 1, training: 1 }, { unique: true });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
