const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['change', 'accident', 'improvement'], // Сүүлд гарсан өөрчлөлт, Ослын сургамж, Сайжруулалт
  },
  // Company - null means all companies (superadmin only)
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null
  },
  // Media attachments
  imageUrl: {
    type: String,
    default: null
  },
  pdfUrl: {
    type: String,
    default: null
  },
  youtubeUrl: {
    type: String,
    default: null
  },
  googleSlidesUrl: {
    type: String,
    default: null
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

module.exports = mongoose.model('News', newsSchema);
