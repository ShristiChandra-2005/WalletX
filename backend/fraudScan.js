const Transaction = require('./models/Transaction');

let lastScanInfo = {
  lastScan: null,
  checkedCount: 0,
  flaggedCount: 0,
  flaggedTxns: []
};

async function runFraudScan() {
  const allTxns = await Transaction.find({});
  let flagged = [];
  let checked = 0;

  for (const tx of allTxns) {
    checked++;
    // Example rule: flag large withdrawals
    if (tx.type === 'withdraw' && tx.amount >= 10000 && !tx.flagged) {
      tx.flagged = true;
      await tx.save();
      flagged.push(tx);
    }
    // Example rule: flag >5 transfers in 10 minutes
    if (tx.type === 'transfer-out') {
      const count = await Transaction.countDocuments({
        user: tx.user,
        type: 'transfer-out',
        createdAt: { $gte: new Date(tx.createdAt.getTime() - 10 * 60 * 1000), $lte: tx.createdAt }
      });
      if (count > 5 && !tx.flagged) {
        tx.flagged = true;
        await tx.save();
        flagged.push(tx);
      }
    }
  }

  lastScanInfo = {
    lastScan: new Date().toLocaleString(),
    checkedCount: checked,
    flaggedCount: flagged.length,
    flaggedTxns: flagged
  };
}

module.exports = {
  runFraudScan,
  getLastScanInfo: () => lastScanInfo
};
