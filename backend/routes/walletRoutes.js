const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

// Deposit (supports multiple currencies)
router.post('/deposit', auth, async (req, res) => {
  const { amount, currency } = req.body;
  if (!amount || amount <= 0 || !currency) return res.status(400).json({ message: "Amount and currency are required" });

  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const balanceBefore = user.balances.get(currency) || 0;
    user.balances.set(currency, balanceBefore + amount);
    await user.save();

    await Transaction.create({
      user: user._id,
      type: 'deposit',
      amount,
      currency,
      balanceBefore,
      balanceAfter: user.balances.get(currency)
    });

    res.json({ message: "Deposit successful", balance: user.balances.get(currency) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});


// Withdraw (supports multiple currencies + fraud detection)
router.post('/withdraw', auth, async (req, res) => {
  const { amount, currency } = req.body;
  if (!amount || amount <= 0 || !currency) return res.status(400).json({ message: "Amount and currency are required" });

  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const balanceBefore = user.balances.get(currency) || 0;
    if (balanceBefore < amount) return res.status(400).json({ message: "Insufficient funds" });

    user.balances.set(currency, balanceBefore - amount);
    await user.save();

    // Save transaction
    const withdrawalTx = await Transaction.create({
      user: user._id,
      type: 'withdraw',
      amount,
      currency,
      balanceBefore,
      balanceAfter: user.balances.get(currency)
    });

    // Fraud detection: Sudden large withdrawal
    const LARGE_WITHDRAWAL_LIMIT = 10000;
    if (amount >= LARGE_WITHDRAWAL_LIMIT) {
      await Transaction.findByIdAndUpdate(withdrawalTx._id, { flagged: true });
    }

    res.json({ message: "Withdrawal successful", balance: user.balances.get(currency) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Transfer (supports multiple currencies + fraud detection)
router.post('/transfer', auth, async (req, res) => {
  const { recipientEmail, amount, currency } = req.body;
  if (!recipientEmail || !amount || amount <= 0 || !currency) {
    return res.status(400).json({ message: 'Recipient, amount, and currency are required' });
  }

  const sender = await User.findById(req.user.userId);
  if (!sender) return res.status(404).json({ message: 'Sender not found' });

  const recipient = await User.findOne({ email: recipientEmail });
  if (!recipient) return res.status(404).json({ message: 'Recipient not found' });

  if (sender.email === recipientEmail) {
    return res.status(400).json({ message: 'Cannot transfer to self' });
  }

  const senderBalance = sender.balances.get(currency) || 0;
  if (senderBalance < amount) {
    return res.status(400).json({ message: 'Insufficient balance' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Deduct from sender
    const senderBalanceBefore = senderBalance;
    sender.balances.set(currency, senderBalance - amount);
    await sender.save({ session });

    // Credit to recipient
    const recipientBalanceBefore = recipient.balances.get(currency) || 0;
    recipient.balances.set(currency, recipientBalanceBefore + amount);
    await recipient.save({ session });

    // Save transactions (one transfer-out, one transfer-in)
    const [transferOut, transferIn] = await Transaction.create([
      {
        user: sender._id,
        type: 'transfer-out',
        amount,
        currency,
        to: recipient._id,
        balanceBefore: senderBalanceBefore,
        balanceAfter: sender.balances.get(currency)
      },
      {
        user: recipient._id,
        type: 'transfer-in',
        amount,
        currency,
        from: sender._id,
        balanceBefore: recipientBalanceBefore,
        balanceAfter: recipient.balances.get(currency)
      }
    ], { session });

    // Fraud detection: check recent transfers in last 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentTransfers = await Transaction.countDocuments({
      user: sender._id,
      type: 'transfer-out',
      currency,
      createdAt: { $gte: tenMinutesAgo }
    });

    if (recentTransfers > 5) {
      await Transaction.findByIdAndUpdate(transferOut._id, { flagged: true }, { session });
    }

    await session.commitTransaction();
    session.endSession();

    res.json({ message: 'Transfer successful', balance: sender.balances.get(currency) });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current balances (all currencies)
router.get('/balance', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ balance: user.balances['INR'] || 0 });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get full transaction history for the logged-in user (deposits, withdraws, transfers)
router.get('/history', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const transactions = await Transaction.find({
      $or: [
        { user: userId },          // deposit, withdraw, transfer-out, transfer-in
        { from: userId },          // if you use a "from" field for transfers
        { to: userId }             // if you use a "to" field for transfers
      ]
    }).sort({ createdAt: -1 });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Admin: Get all flagged transactions
router.get('/admin/flagged', auth, async (req, res) => {
  const flaggedTxs = await Transaction.find({ flagged: true }).populate('user', 'email');
  res.json(flaggedTxs);
});

module.exports = router;

