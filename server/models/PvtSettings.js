const mongoose = require('mongoose');

// Singleton document holding the PVT scoring thresholds (admin-configurable).
const pvtSettingsSchema = new mongoose.Schema({
  key:            { type: String, default: 'default', unique: true },
  meanRtFail:     { type: Number, default: 560 },  // mean RT (ms) >= this => fail
  lapseRt:        { type: Number, default: 560 },  // trial RT (ms) >= this => lapse
  maxLapses:      { type: Number, default: 3 },    // lapses >= this => fail
  falseStartRt:   { type: Number, default: 100 },  // trial RT (ms) < this => false start
  maxFalseStarts: { type: Number, default: 2 },    // false starts >= this => fail
  normalRt:       { type: Number, default: 350 },  // display: below = normal, above = warning
}, { timestamps: true });

pvtSettingsSchema.statics.getSingleton = async function () {
  let doc = await this.findOne({ key: 'default' });
  if (!doc) doc = await this.create({ key: 'default' });
  return doc;
};

module.exports = mongoose.model('PvtSettings', pvtSettingsSchema);
