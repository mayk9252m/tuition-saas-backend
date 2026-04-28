const Student = require('../models/Student');

// @desc    Mark attendance for a student
// @route   POST /api/attendance/:studentId
const markAttendance = async (req, res) => {
  try {
    const { date, status } = req.body;

    if (!date || !status) {
      return res.status(400).json({ message: 'Date and status are required' });
    }

    if (!['present', 'absent'].includes(status)) {
      return res.status(400).json({ message: 'Status must be present or absent' });
    }

    const student = await Student.findOne({ _id: req.params.studentId, userId: req.user._id });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Check if attendance already marked for this date
    const existingIndex = student.attendance.findIndex(a => a.date === date);

    if (existingIndex > -1) {
      student.attendance[existingIndex].status = status;
    } else {
      student.attendance.push({ date, status });
    }

    await student.save();

    res.json({ success: true, message: 'Attendance marked successfully', student });
  } catch (error) {
    res.status(500).json({ message: 'Error marking attendance', error: error.message });
  }
};

// @desc    Get attendance for a student
// @route   GET /api/attendance/:studentId
const getAttendance = async (req, res) => {
  try {
    const { month } = req.query; // Format: YYYY-MM

    const student = await Student.findOne({ _id: req.params.studentId, userId: req.user._id });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    let attendance = student.attendance;

    if (month) {
      attendance = attendance.filter(a => a.date.startsWith(month));
    }

    res.json({ success: true, attendance });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching attendance', error: error.message });
  }
};

// @desc    Mark bulk attendance for all students on a date
// @route   POST /api/attendance/bulk
const markBulkAttendance = async (req, res) => {
  try {
    const { date, attendanceData } = req.body;
    // attendanceData: [{ studentId, status }]

    if (!date || !attendanceData || !Array.isArray(attendanceData)) {
      return res.status(400).json({ message: 'Date and attendance data array are required' });
    }

    const results = [];

    for (const item of attendanceData) {
      const student = await Student.findOne({ _id: item.studentId, userId: req.user._id });
      if (student) {
        const existingIndex = student.attendance.findIndex(a => a.date === date);
        if (existingIndex > -1) {
          student.attendance[existingIndex].status = item.status;
        } else {
          student.attendance.push({ date, status: item.status });
        }
        await student.save();
        results.push({ studentId: item.studentId, success: true });
      }
    }

    res.json({ success: true, message: 'Bulk attendance marked', results });
  } catch (error) {
    res.status(500).json({ message: 'Error marking bulk attendance', error: error.message });
  }
};

// @desc    Get today's attendance summary
// @route   GET /api/attendance/today
const getTodayAttendance = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const students = await Student.find({ userId: req.user._id, isActive: true });

    const summary = students.map(s => {
      const todayRecord = s.attendance.find(a => a.date === today);
      return {
        studentId: s._id,
        studentName: s.studentName,
        class: s.class,
        status: todayRecord ? todayRecord.status : 'not_marked'
      };
    });

    const present = summary.filter(s => s.status === 'present').length;
    const absent = summary.filter(s => s.status === 'absent').length;
    const notMarked = summary.filter(s => s.status === 'not_marked').length;

    res.json({
      success: true,
      date: today,
      summary,
      stats: { present, absent, notMarked, total: students.length }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching today attendance', error: error.message });
  }
};

module.exports = { markAttendance, getAttendance, markBulkAttendance, getTodayAttendance };
