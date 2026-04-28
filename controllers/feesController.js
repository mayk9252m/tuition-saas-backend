const Student = require('../models/Student');

// @desc    Update fee status for a student
// @route   PUT /api/fees/:studentId/:month
const updateFeeStatus = async (req, res) => {
  try {
    const { studentId, month } = req.params;
    const { status } = req.body;

    if (!['paid', 'unpaid'].includes(status)) {
      return res.status(400).json({ message: 'Status must be paid or unpaid' });
    }

    const student = await Student.findOne({ _id: studentId, userId: req.user._id });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const feeRecord = student.feesHistory.find(f => f.month === month);
    if (!feeRecord) {
      return res.status(404).json({ message: 'Fee record not found for this month' });
    }

    feeRecord.status = status;
    if (status === 'paid') {
      feeRecord.paidDate = new Date();
    } else {
      feeRecord.paidDate = null;
    }

    await student.save();

    res.json({ success: true, message: 'Fee status updated', student });
  } catch (error) {
    res.status(500).json({ message: 'Error updating fee status', error: error.message });
  }
};

// @desc    Get fees summary
// @route   GET /api/fees/summary
const getFeesSummary = async (req, res) => {
  try {
    const { month } = req.query;
    const students = await Student.find({ userId: req.user._id, isActive: true });

    let totalCollected = 0;
    let totalPending = 0;
    let details = [];

    students.forEach(student => {
      let fees = student.feesHistory;
      if (month) {
        fees = fees.filter(f => f.month === month);
      }

      fees.forEach(fee => {
        if (fee.status === 'paid') {
          totalCollected += fee.amount;
        } else {
          totalPending += fee.amount;
        }
      });

      if (month) {
        const monthFee = student.feesHistory.find(f => f.month === month);
        details.push({
          studentId: student._id,
          studentName: student.studentName,
          class: student.class,
          amount: monthFee ? monthFee.amount : student.monthlyFees,
          status: monthFee ? monthFee.status : 'unpaid',
          paidDate: monthFee ? monthFee.paidDate : null
        });
      }
    });

    res.json({
      success: true,
      summary: {
        totalCollected,
        totalPending,
        total: totalCollected + totalPending
      },
      details: month ? details : []
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching fees summary', error: error.message });
  }
};

// @desc    Send WhatsApp fee reminders (called by cron job)
const sendFeeReminders = async () => {
  try {
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    const currentMonth = new Date().toISOString().slice(0, 7);
    const students = await Student.find({ isActive: true });

    for (const student of students) {
      const currentFee = student.feesHistory.find(f => f.month === currentMonth);

      if (currentFee && currentFee.status === 'unpaid') {
        try {
          await client.messages.create({
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: `whatsapp:+91${student.whatsappNumber}`,
            body: `📚 Fee Reminder\n\nDear Parent of ${student.studentName},\n\nYour monthly tuition fee of ₹${currentFee.amount} for ${currentMonth} is pending.\n\nPlease pay at your earliest convenience.\n\nThank you! 🙏`
          });
          console.log(`✅ Reminder sent to ${student.studentName} (${student.whatsappNumber})`);
        } catch (twilioError) {
          console.error(`❌ Failed to send reminder to ${student.studentName}:`, twilioError.message);
        }
      }
    }
  } catch (error) {
    console.error('Error in sendFeeReminders:', error.message);
  }
};

// @desc    Send manual fee reminder
// @route   POST /api/fees/remind/:studentId
const sendManualReminder = async (req, res) => {
  try {
    const student = await Student.findOne({ _id: req.params.studentId, userId: req.user._id });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentFee = student.feesHistory.find(f => f.month === currentMonth);
    const amount = currentFee ? currentFee.amount : student.monthlyFees;

    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      return res.status(400).json({ message: 'Twilio credentials not configured' });
    }

    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: `whatsapp:+91${student.whatsappNumber}`,
      body: `📚 Fee Reminder\n\nDear Parent of ${student.studentName},\n\nYour monthly tuition fee of ₹${amount} for ${currentMonth} is pending.\n\nPlease pay at your earliest convenience.\n\nThank you! 🙏`
    });

    res.json({ success: true, message: `Fee reminder sent to ${student.studentName}` });
  } catch (error) {
    res.status(500).json({ message: 'Error sending reminder', error: error.message });
  }
};

module.exports = { updateFeeStatus, getFeesSummary, sendFeeReminders, sendManualReminder };
