const mongoose = require('mongoose');

// Generate a unique certificate number
const generateCertificateNumber = () => {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  return `CERT-${year}-${random}${timestamp}`;
};

const certificateSchema = new mongoose.Schema({
  certificateNumber: { 
    type: String, 
    unique: true,
    default: generateCertificateNumber
  },
  worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  training: { type: mongoose.Schema.Types.ObjectId, ref: 'Training', required: true },
  enrollment: { type: mongoose.Schema.Types.ObjectId, ref: 'Enrollment', required: true },
  score: { type: Number, required: true },
  attempts: { type: Number, required: true },
  issuedAt: { type: Date, default: Date.now },
  issuedBy: { type: String, default: 'Сургалтын систем' },
  signature: { type: String }, // Can store signature image URL or data
  expiresAt: { type: Date }, // Expiry date based on training validity period
  isValid: { type: Boolean, default: true },
  status: { type: String, enum: ['active', 'revoked', 'expired'], default: 'active' }
}, { timestamps: true });

// Virtual to check if certificate is expired
certificateSchema.virtual('isExpired').get(function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

// Virtual to check current validity status
certificateSchema.virtual('currentStatus').get(function() {
  if (!this.isValid) return 'revoked';
  if (this.expiresAt && new Date() > this.expiresAt) return 'expired';
  return 'valid';
});

// Enable virtuals in JSON
certificateSchema.set('toJSON', { virtuals: true });
certificateSchema.set('toObject', { virtuals: true });

// Ensure one certificate per worker-training combination
certificateSchema.index({ worker: 1, training: 1 }, { unique: true });

// Static method to generate certificate number
certificateSchema.statics.generateNumber = generateCertificateNumber;

module.exports = mongoose.model('Certificate', certificateSchema);
