const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const cron = require('node-cron');

const { sendToMultiple } = require('./services/notificationService');


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
app.use('/api/tests', require('./routes/tests'));
app.use('/api/parent', require('./routes/parent'));
app.use('/uploads', express.static('uploads')); // Serve static files from uploads directory

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

    // Daily cron job at 9 AM
    cron.schedule('0 9 * * *', async () => {
      console.log('⏰ Running daily reminders...');

      try {
        // Existing SMS reminders
        const { sendFeeReminders } = require('./controllers/feesController');
        await sendFeeReminders();

        // Push notification reminders
        const Student = require('./models/Student');

        const currentMonth = new Date().toISOString().slice(0, 7);

        const students = await Student.find({
          isActive: true,
          parentFcmToken: { $ne: '' }
        });

        const unpaidStudents = students.filter(student =>
          student.feesHistory.some(fee =>
            fee.month === currentMonth &&
            fee.status === 'unpaid'
          )
        );

        // Send push notifications
        await sendToMultiple(
          unpaidStudents,
          '💰 Fee Reminder',
          `Your tuition fee for ${currentMonth} is pending. Please pay at the earliest.`,
          'fee_reminder'
        );

        console.log(`📱 Push reminders sent to ${unpaidStudents.length} parents`);

      } catch (error) {
        console.error('❌ Cron job error:', error.message);
      }
    });

  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

module.exports = app;