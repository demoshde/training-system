const mongoose = require('mongoose');

const supervisorFeedbackSchema = new mongoose.Schema({
  worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  training: { type: mongoose.Schema.Types.ObjectId, ref: 'Training' },
  comment: { type: String },
  rating: { type: String, enum: ['like', 'dislike'], required: true },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Index for quick lookup by worker
supervisorFeedbackSchema.index({ worker: 1, createdAt: -1 });

module.exports = mongoose.model('SupervisorFeedback', supervisorFeedbackSchema);
