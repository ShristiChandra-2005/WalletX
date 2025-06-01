const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();


const app = express();
app.use(cors());
app.use(express.json());

const authRoutes = require('./routes/authRoutes');
app.use('/api', authRoutes);

const adminRoutes = require('./routes/adminRoutes');
app.use('/api/admin', adminRoutes);

const walletRoutes = require('./routes/walletRoutes');
app.use('/api', walletRoutes);

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

//fraudScan
const cron = require('node-cron');
const fraudScan = require('./fraudScan');

// Schedule daily scan at 2:00 AM
cron.schedule('0 2 * * *', () => {
  fraudScan.runFraudScan();
  console.log("Fraud scan completed at", new Date());
});
app.use('/api/wallet', require('./routes/walletRoutes'));
