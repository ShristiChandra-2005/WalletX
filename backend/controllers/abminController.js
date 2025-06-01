// backend/controllers/adminController.js
const Transaction = require('../models/Transaction');
const User = require('../models/User');

// 1. Return flagged transactions
exports.flaggedTransactions = async (req, res) => {
  try {
    const flagged = await Transaction.find({ flagged: true })
      .populate('user', 'email')
      .populate('to', 'email');
    res.json(flagged);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching flagged transactions' });
  }
};

// 2. Aggregate and return total balances
exports.totalBalances = async (req, res) => {
  try {
    const result = await User.aggregate([
      { $group: { _id: null, total: { $sum: "$balance" } } }
    ]);
    res.json({ total: result[0]?.total || 0 });
  } catch (err) {
    res.status(500).json({ message: 'Error aggregating balances' });
  }
};

// 3. Return top users by balance
exports.topUsers = async (req, res) => {
  try {
    const top = await User.find().sort({ balance: -1 }).limit(10).select('email balance');
    res.json(top);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching top users' });
  }
};
