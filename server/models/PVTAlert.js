const mongoose = require('mongoose');

const pvtAlertSchema = new mongoose.Schema({
  company:    { type: mongoose.Schema.Types.ObjectId, ref: 'Company',   required: true },
  driver:     { type: mongoose.Schema.Types.ObjectId, ref: 'Worker',    required: true },
  test:       { type: mongoose.Schema.Types.ObjectId, ref: 'PVTTest',   required: true },
  driverName: { type: String, required: true },
  driverSap:  { type: String, required: true },
  isRead:     { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('PVTAlert', pvtAlertSchema);
