const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const fraudScan = require('../fraudScan');



// ======== TOTAL USERS ========
router.get('/total-users', auth, admin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: "user" });
    res.json({ totalUsers });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// ======== TOTAL BALANCE (supports multi-currency) ========
router.get('/total-balances', auth, admin, async (req, res) => {
  try {
    const users = await User.find({ role: "user" });
    let totalBalance = 0;
    users.forEach(user => {
      if (user.balances) {
        for (const amount of user.balances.values()) {
          totalBalance += amount;
        }
      } else {
        totalBalance += user.balance || 0;
      }
    });
    res.json({ totalBalance });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// ======== FLAGGED TRANSACTIONS ========
router.get('/flagged', auth, admin, async (req, res) => {
  try {
    const flagged = await Transaction.find({ flagged: true })
      .sort({ createdAt: -1 })
      .populate('user', 'email');
    res.json(flagged);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// ======== TOP USER BY BALANCE ========
router.get('/top-users', auth, admin, async (req, res) => {
  try {
    const users = await User.find({ role: "user" });
    let topUser = null;
    let maxBalance = -Infinity;
    users.forEach(user => {
      let bal = 0;
      if (user.balances) {
        for (const amount of user.balances.values()) {
          bal += amount;
        }
      } else {
        bal = user.balance || 0;
      }
      if (bal > maxBalance) {
        maxBalance = bal;
        topUser = { name: user.name, email: user.email, balance: bal };
      }
    });
    res.json(topUser ? [topUser] : []);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// ======== ALL TRANSACTIONS (for admin) ========
router.get('/all-transactions', auth, admin, async (req, res) => {
  try {
    const txns = await Transaction.find()
      .populate('user', 'email')
      .sort({ createdAt: -1 });
    res.json(txns);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// ======== FILTERED TRANSACTIONS (for reports) ========
router.get('/transactions', auth, admin, async (req, res) => {
  try {
    const { user, type, flagged, startDate, endDate } = req.query;
    let filter = {};

    if (user) {
      const foundUser = await User.findOne({ $or: [{ email: user }, { _id: user }] });
      if (foundUser) filter.user = foundUser._id;
      else return res.json([]);
    }
    if (type) filter.type = type;
    if (flagged !== undefined) filter.flagged = flagged === 'true';
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const txns = await Transaction.find(filter)
      .populate('user', 'email')
      .populate('to', 'email')
      .populate('from', 'email')
      .sort({ createdAt: -1 });
    res.json(txns);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// ======== USER LIST WITH FILTERS ========
router.get('/users', auth, admin, async (req, res) => {
  try {
    const { search, status } = req.query;
    let filter = {};
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) filter.status = status;
    const users = await User.find(filter).select('name email balance createdAt status');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// ======== BLOCK/ACTIVATE/DELETE USER ========
router.patch('/users/:id/block', auth, admin, async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, { status: 'blocked' });
  res.json({ message: 'User blocked.' });
});
router.patch('/users/:id/activate', auth, admin, async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, { status: 'active' });
  res.json({ message: 'User reactivated.' });
});
router.delete('/users/:id', auth, admin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    await Transaction.deleteMany({ user: req.params.id });
    res.json({ message: "User and their transactions deleted." });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// ======== MARK TRANSACTION AS REVIEWED ========
router.patch('/transactions/:id/review', auth, admin, async (req, res) => {
  await Transaction.findByIdAndUpdate(req.params.id, { flagged: false });
  res.json({ message: 'Transaction marked as reviewed.' });
});

// ======== REPORTS: FILTERED TRANSACTIONS (for report page) ========
router.get('/report/transactions', auth, admin, async (req, res) => {
  try {
    const { startDate, endDate, email, type, flagged } = req.query;
    let filter = {};

    if (startDate && endDate) {
      filter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (email) {
      const user = await User.findOne({ email });
      if (user) filter.user = user._id;
      else return res.json([]);
    }
    if (type) filter.type = type;
    if (flagged === 'true') filter.flagged = true;

    const transactions = await Transaction.find(filter)
      .populate('user', 'email')
      .sort({ createdAt: -1 });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// ======== (OPTIONAL) SETTINGS ENDPOINTS ========
let fraudSettings = { maxTransfersPerHour: 5, notificationEmail: 'admin@walletx.com' };
router.get('/settings', auth, admin, (req, res) => {
  res.json(fraudSettings);
});
router.post('/settings', auth, admin, (req, res) => {
  const { maxTransfersPerHour, notificationEmail } = req.body;
  if (maxTransfersPerHour) fraudSettings.maxTransfersPerHour = maxTransfersPerHour;
  if (notificationEmail) fraudSettings.notificationEmail = notificationEmail;
  res.json({ message: 'Settings updated.', fraudSettings });
});

// Get last fraud scan status
router.get('/fraudscan/status', auth, admin, (req, res) => {
  res.json(fraudScan.getLastScanInfo());
});

// Run scan manually (for demo/testing)
router.post('/fraudscan/run', auth, admin, async (req, res) => {
  await fraudScan.runFraudScan();
  res.json({ message: "Fraud scan completed." });
});
//Admin Alert -- in front
const AdminAlert = require('../models/AdminAlert');

router.get('/alerts', auth, admin, async (req, res) => {
  const alerts = await AdminAlert.find().sort({ createdAt: -1 }).limit(10);
  res.json(alerts);
});

module.exports = router;
