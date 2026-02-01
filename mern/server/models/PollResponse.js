const mongoose = require('mongoose');

const pollResponseSchema = new mongoose.Schema({
  poll: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Poll',
    required: true
  },
  worker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker',
    required: true
  },
  answers: [{
    questionIndex: Number,
    questionText: String,
    answer: mongoose.Schema.Types.Mixed, // Can be string, number (rating), or array (multiple choice)
    answerType: String
  }],
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Ensure one response per worker per poll
pollResponseSchema.index({ poll: 1, worker: 1 }, { unique: true });

module.exports = mongoose.model('PollResponse', pollResponseSchema);
