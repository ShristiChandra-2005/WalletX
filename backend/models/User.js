// backend/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  // Replace balance with balances map:
  balances: {
    type: Map,
    of: Number,
    default: {} // e.g., { "INR": 1000, "USD": 50 }
  },
  role: {
    type: String,
    default: "user",
    enum: ["user", "admin"]
  }
});

module.exports = mongoose.model('User', userSchema);
