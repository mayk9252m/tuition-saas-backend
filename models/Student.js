const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true
  },
  status: {
    type: String,
    enum: ['present', 'absent'],
    required: true
  }
});

const feesHistorySchema = new mongoose.Schema({
  month: {
    type: String, // Format: YYYY-MM
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['paid', 'unpaid'],
    default: 'unpaid'
  },
  paidDate: {
    type: Date
  },
  dueDate: {
    type: Date
  }
});

const studentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  studentName: {
    type: String,
    required: [true, 'Student name is required'],
    trim: true
  },
  fatherName: {
    type: String,
    required: [true, "Father's name is required"],
    trim: true
  },
  motherName: {
    type: String,
    required: [true, "Mother's name is required"],
    trim: true
  },
  class: {
    type: String,
    required: [true, 'Class is required'],
    enum: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
  },
  school: {
    type: String,
    required: [true, 'School is required'],
    trim: true
  },
  whatsappNumber: {
    type: String,
    required: [true, 'WhatsApp number is required'],
    trim: true
  },
  dateOfJoining: {
    type: Date,
    required: [true, 'Date of joining is required']
  },
  monthlyFees: {
    type: Number,
    required: [true, 'Monthly fees is required'],
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  attendance: [attendanceSchema],
  feesHistory: [feesHistorySchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
studentSchema.index({ userId: 1 });
studentSchema.index({ userId: 1, class: 1 });

// Auto-generate monthly fees on save
studentSchema.methods.generateMonthlyFees = function() {
  const joiningDate = new Date(this.dateOfJoining);
  const currentDate = new Date();
  const fees = [];

  let date = new Date(joiningDate.getFullYear(), joiningDate.getMonth(), 1);
  const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

  while (date <= endDate) {
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const exists = this.feesHistory.find(f => f.month === monthKey);
    if (!exists) {
      fees.push({
        month: monthKey,
        amount: this.monthlyFees,
        status: 'unpaid',
        dueDate: new Date(date.getFullYear(), date.getMonth() + 1, 5)
      });
    }
    date.setMonth(date.getMonth() + 1);
  }

  return fees;
};

module.exports = mongoose.model('Student', studentSchema);
