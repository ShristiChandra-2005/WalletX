// backend/controllers/walletController.js
const User = require('../models/User');
const Transaction = require('../models/Transaction');

exports.deposit = async (req, res) => {
  const { amount } = req.body;
  if (amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
  const user = await User.findById(req.user.id);
  user.balance += amount;
  await user.save();
  await Transaction.create({ user: user._id, type: 'deposit', amount });
  res.json({ message: 'Deposit successful', balance: user.balance });
};

exports.withdraw = async (req, res) => {
  const { amount } = req.body;
  const user = await User.findById(req.user.id);
  if (amount <= 0 || user.balance < amount) return res.status(400).json({ message: 'Invalid or insufficient funds' });
  user.balance -= amount;
  await user.save();
  await Transaction.create({ user: user._id, type: 'withdraw', amount });
  res.json({ message: 'Withdraw successful', balance: user.balance });
};

exports.transfer = async (req, res) => {
  const { to, amount } = req.body;
  const sender = await User.findById(req.user.id);
  const recipient = await User.findOne({ email: to });
  if (!recipient) return res.status(400).json({ message: 'Recipient not found' });
  if (amount <= 0 || sender.balance < amount) return res.status(400).json({ message: 'Invalid or insufficient funds' });
  sender.balance -= amount;
  recipient.balance += amount;
  await sender.save();
  await recipient.save();
  await Transaction.create({ user: sender._id, type: 'transfer', amount, to: recipient._id });
  await Transaction.create({ user: recipient._id, type: 'receive', amount, to: sender._id });
  res.json({ message: 'Transfer successful', balance: sender.balance });
};
