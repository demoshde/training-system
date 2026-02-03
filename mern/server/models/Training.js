const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  isCorrect: { type: Boolean, default: false }
});

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  options: [optionSchema],
  order: { type: Number, default: 0 }
});

const slideSchema = new mongoose.Schema({
  title: { type: String },
  content: { type: String },
  url: { type: String },           // Image or PDF URL
  fileName: { type: String },      // Original file name
  contentType: { type: String },   // MIME type (image/*, application/pdf)
  type: { type: String, default: 'file' }, // 'file' or 'text'
  imageUrl: { type: String },      // Legacy field
  pdfUrl: { type: String },        // Legacy field
  videoUrl: { type: String },
  duration: { type: Number, default: 10 }, // Duration in seconds before next button is available
  layout: { type: String, default: 'default' },
  order: { type: Number, default: 0 }
});

const trainingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  slides: [slideSchema],
  questions: [questionSchema],
  passingScore: { type: Number, default: 70 },
  validityPeriod: { type: Number, default: 0 }, // Validity in months (0 = never expires)
  isMandatory: { type: Boolean, default: false }, // Auto-enroll all new workers
  isActive: { type: Boolean, default: true },
  deletedAt: { type: Date, default: null } // Soft delete - null means not deleted
}, { timestamps: true });

module.exports = mongoose.model('Training', trainingSchema);
