const mongoose = require('mongoose');

const regulationSchema = new mongoose.Schema({
  regulationNumber: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  pdfUrl: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['safety', 'work', 'environment', 'other'],
    default: 'other'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Regulation', regulationSchema);
