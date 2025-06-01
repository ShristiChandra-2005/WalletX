const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const MONGO_URI = 'mongodb://localhost:27017/mywalletdb'; // Use your DB name

async function createAdmin() {
  await mongoose.connect(MONGO_URI);
  const email = 'admin@gmail.com';
  const password = 'Admin@123';
  const name = 'Admin';

  const existing = await User.findOne({ email });
  const hashedPassword = await bcrypt.hash(password, 10);

  if (existing) {
    existing.password = hashedPassword;
    existing.role = 'admin';
    existing.name = name;
    await existing.save();
    console.log('Existing user updated to admin.');
  } else {
    const admin = new User({
      name,
      email,
      password: hashedPassword,
      role: 'admin'
    });
    await admin.save();
    console.log('Admin account created successfully!');
  }
  process.exit();
}

createAdmin();
