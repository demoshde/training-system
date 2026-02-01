const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  questions: [{
    questionText: {
      type: String,
      required: true
    },
    questionType: {
      type: String,
      enum: ['text', 'rating', 'multiple_choice', 'single_choice'],
      default: 'text'
    },
    options: [{
      text: String
    }],
    required: {
      type: Boolean,
      default: false
    }
  }],
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  },
  targetAudience: {
    type: String,
    enum: ['all', 'company'],
    default: 'all'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Poll', pollSchema);
