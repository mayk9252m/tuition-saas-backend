const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const cron = require('node-cron');

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/students', require('./routes/students'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/fees', require('./routes/fees'));
app.use('/api/analytics', require('./routes/analytics'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Tuition SaaS API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected successfully');

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    // Schedule cron job: every day at 9 AM to send fee reminders
    cron.schedule('0 9 * * *', async () => {
      console.log('⏰ Running daily fee reminder cron job...');
      const { sendFeeReminders } = require('./controllers/feesController');
      await sendFeeReminders();
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

module.exports = app;
