const mongoose = require('mongoose');

const pvtDriverSchema = new mongoose.Schema({
  sapNumber:        { type: String, required: true, unique: true, uppercase: true, trim: true },
  fullName:         { type: String, required: true, trim: true },
  age:              { type: Number, required: true },
  company:          { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  shiftType:        { type: String, enum: ['Day', 'Night'], required: true },
  logisticsTrack:   { type: String, enum: ['Short Haul Driver', 'Convoy Driver'], required: true },
  convoyConfig:     { type: String, default: '' }, // e.g. 'Convoy-1', 'Convoy-2'
  accommodationUnit:{ type: String, default: '' }, // hidden from driver
  roomCapacity:     { type: String, enum: ['Single', '2-person', '3+ shared'], default: 'Single' },
  isActive:         { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('PVTDriver', pvtDriverSchema);
