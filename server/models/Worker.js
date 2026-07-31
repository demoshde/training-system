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
  isActive: { type: Boolean, default: true },
  // PVT Fleet fields
  shiftType: { type: String, enum: ['Өдөр', 'Шөнө', 'Цуваа-1', 'Цуваа-2', 'Цуваа-3', 'Цуваа-4', 'Цуваа-5', 'Цуваа-6', 'Цуваа-7', 'Day', 'Night', 'Цуваа'], default: 'Өдөр' },
  logisticsTrack:    { type: String, enum: ['Short Haul Driver', 'Convoy Driver'], default: 'Short Haul Driver' },
  convoyConfig:      { type: String, default: '' },
  accommodationUnit: { type: String, default: '' },
  roomCapacity:      { type: String, enum: ['Single', '2-person', '3+ shared'], default: 'Single' }
}, { timestamps: true });

module.exports = mongoose.model('Worker', workerSchema);
