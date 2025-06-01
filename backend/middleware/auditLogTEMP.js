// backend/middleware/auditLog.js
const fs = require('fs');
module.exports = function auditLog(req, res, next) {
  const user = req.user ? req.user.userId : 'unknown';
  const log = `[${new Date().toISOString()}] ${user} ${req.method} ${req.originalUrl}\n`;
  fs.appendFile('admin_audit.Log', log, () => {});
  next();
};
