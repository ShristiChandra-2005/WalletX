const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['deposit', 'withdraw', 'transfer-in', 'transfer-out'], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  balanceBefore: Number,     // Optional, but good for audit
  balanceAfter: Number,      // Optional, but good for audit
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },      // For transfers
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },    // For transfers
  flagged: { type: Boolean, default: false },
  description: { type: String },                                  // Optional
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' } // Optional
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
