const mongoose = require('mongoose');

const adminAlertSchema = new mongoose.Schema({
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AdminAlert', adminAlertSchema);
