const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema({
  sapId: { type: String, required: true, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  position: { type: String },
  birthDate: { type: Date },
  employmentDate: { type: Date },
  helmetColor: { type: String, enum: ['Ногоон', 'Цагаан'] },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Worker', workerSchema);
