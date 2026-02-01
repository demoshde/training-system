const mongoose = require('mongoose');

const workerLoginSchema = new mongoose.Schema({
  worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  loginAt: { type: Date, default: Date.now },
  ipAddress: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('WorkerLogin', workerLoginSchema);
