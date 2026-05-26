const jwt = require('jsonwebtoken');
const Student = require('../models/Student');

const generateParentToken = (studentId, mongoId) => {
  return jwt.sign(
    { studentId, mongoId, role: 'parent' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

// @route POST /api/parent/login
const parentLogin = async (req, res) => {
  try {
    const { whatsappNumber, dateOfJoining } = req.body;

    if (!whatsappNumber || !dateOfJoining) {
      return res.status(400).json({
        message: 'WhatsApp number and date of joining are required'
      });
    }
    // Clean the number - remove +91, spaces, dashes, etc, and take last 10 digits
    const cleanNumber = whatsappNumber.replace(/[\s\-\+]/g, '').slice(-10);
    // Find student by WhatsApp number and active status
    const student = await Student.findOne({
      whatsappNumber: cleanNumber,
      isActive: true
    });

    if (!student) {
      return res.status(401).json({
        message: 'Invalid WhatsApp number or Date of Joining'
      });
    }
    // Check date of joining - compare YYYY-MM-DD part only
    const studentJoining = new Date(student.dateOfJoining)
      .toISOString().split('T')[0];

    if (studentJoining !== dateOfJoining) {
      return res.status(401).json({
        message: 'Invalid WhatsApp number or Date of Joining'
      });
    }

    const token = generateParentToken(student.studentId, student._id);

    res.json({
      success: true,
      token,
      student: {
        id:             student._id,
        studentId:      student.studentId,
        studentName:    student.studentName,
        fatherName:     student.fatherName,
        motherName:     student.motherName,
        studentClass:   student.class,
        school:         student.school,
        whatsappNumber: student.whatsappNumber,
        dateOfJoining:  student.dateOfJoining,
        monthlyFees:    student.monthlyFees
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Login error', error: error.message });
  }
};

// Parent JWT middleware
const parentProtect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return res.status(401).json({ message: 'Not authorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'parent') {
      return res.status(401).json({ message: 'Not a parent token' });
    }

    const student = await Student.findById(decoded.mongoId);
    if (!student) return res.status(401).json({ message: 'Student not found' });

    req.student = student;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token invalid or expired' });
  }
};

// @route GET /api/parent/dashboard
const getDashboard = async (req, res) => {
  try {
    const student = req.student;
    const User = require('../models/User');
    const tutor = await User.findById(student.userId);

    const today = new Date().toISOString().split('T')[0];
    const last30Dates = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last30Dates.push(d.toISOString().split('T')[0]);
    }

    const attLast30 = student.attendance.filter(a =>
      last30Dates.includes(a.date)
    );
    const presentLast30 = attLast30.filter(a => a.status === 'present').length;
    const absentLast30  = attLast30.filter(a => a.status === 'absent').length;
    const totalMarked   = presentLast30 + absentLast30;
    const attendanceRate = totalMarked > 0
      ? Math.round((presentLast30 / totalMarked) * 100) : 0;

    const todayAtt = student.attendance.find(a => a.date === today);

    const currentMonth = today.slice(0, 7);
    const currentFee   = student.feesHistory.find(f => f.month === currentMonth);
    const pendingFees  = student.feesHistory.filter(f => f.status === 'unpaid');
    const pendingTotal = pendingFees.reduce((sum, f) => sum + f.amount, 0);

    const allPcts = student.testResults.map(t =>
      Math.round((t.marksObtained / t.totalMarks) * 100)
    );
    const avgScore = allPcts.length
      ? Math.round(allPcts.reduce((a, b) => a + b, 0) / allPcts.length)
      : null;

    const latestTest = student.testResults.length > 0
      ? [...student.testResults].sort((a, b) =>
          new Date(b.testDate) - new Date(a.testDate)
        )[0]
      : null;

    res.json({
      success: true,
      dashboard: {
        student: {
          studentId:    student.studentId,
          studentName:  student.studentName,
          studentClass: student.class,
          school:       student.school,
          monthlyFees:  student.monthlyFees,
          dateOfJoining: student.dateOfJoining
            ? new Date(student.dateOfJoining).toISOString().split('T')[0]
            : null
        },
        tutor: {
          name:      tutor?.name      || 'Your Tutor',
          qrCodeUrl: tutor?.qrCodeUrl || null,
          upiId:     tutor?.upiId     || null
        },
        attendance: {
          today:             todayAtt?.status || 'not_marked',
          presentLast30,
          absentLast30,
          totalMarkedLast30: totalMarked,
          attendanceRate
        },
        fees: {
          currentMonth,
          currentStatus: currentFee?.status  || 'unpaid',
          currentAmount: currentFee?.amount  || student.monthlyFees,
          pendingCount:  pendingFees.length,
          pendingTotal
        },
        tests: {
          totalTests: student.testResults.length,
          avgScore,
          latestTest: latestTest ? {
            subject:       latestTest.subject,
            testDate:      latestTest.testDate,
            marksObtained: latestTest.marksObtained,
            totalMarks:    latestTest.totalMarks,
            pct: Math.round(
              (latestTest.marksObtained / latestTest.totalMarks) * 100
            )
          } : null
        }
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Dashboard error', error: error.message });
  }
};

// @route GET /api/parent/attendance
const getAttendance = async (req, res) => {
  try {
    const student = req.student;
    const allAtt = student.attendance.sort((a, b) =>
      new Date(b.date) - new Date(a.date)
    );

    const months = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey  = d.toISOString().slice(0, 7);
      const monthName = d.toLocaleString('default', {
        month: 'long', year: 'numeric'
      });
      const records = allAtt.filter(a => a.date.startsWith(monthKey));
      months.push({
        month: monthKey,
        monthName,
        present: records.filter(r => r.status === 'present').length,
        absent:  records.filter(r => r.status === 'absent').length,
        records
      });
    }

    res.json({ success: true, months, allAttendance: allAtt });
  } catch (error) {
    res.status(500).json({ message: 'Attendance error', error: error.message });
  }
};

// @route GET /api/parent/fees
const getFees = async (req, res) => {
  try {
    const student = req.student;
    const User    = require('../models/User');
    const tutor   = await User.findById(student.userId);

    const history = student.feesHistory.sort((a, b) =>
      b.month.localeCompare(a.month)
    );
    const paid    = history.filter(f => f.status === 'paid');
    const pending = history.filter(f => f.status === 'unpaid');

    res.json({
      success: true,
      fees: {
        monthlyAmount: student.monthlyFees,
        feesHistory:   history.map(f => ({
          ...f._doc,
          paidDate: f.paidDate
            ? new Date(f.paidDate).toISOString().split('T')[0]
            : null
        })),
        totalPaid:     paid.reduce((s, f) => s + f.amount, 0),
        totalPending:  pending.reduce((s, f) => s + f.amount, 0),
        paidMonths:    paid.length,
        pendingMonths: pending.length
      },
      payment: {
        qrCodeUrl: tutor?.qrCodeUrl || null,
        upiId:     tutor?.upiId     || null,
        tutorName: tutor?.name      || 'Your Tutor'
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Fees error', error: error.message });
  }
};

// @route GET /api/parent/tests
const getTests = async (req, res) => {
  try {
    const student = req.student;
    const tests = [...student.testResults].sort((a, b) =>
      new Date(b.testDate) - new Date(a.testDate)
    );

    const allPcts = tests.map(t =>
      Math.round((t.marksObtained / t.totalMarks) * 100)
    );
    const overallAvg   = allPcts.length
      ? Math.round(allPcts.reduce((a, b) => a + b, 0) / allPcts.length) : 0;
    const highestScore = allPcts.length ? Math.max(...allPcts) : 0;
    const lowestScore  = allPcts.length ? Math.min(...allPcts) : 0;

    const subjectMap = {};
    tests.forEach(t => {
      if (!subjectMap[t.subject]) subjectMap[t.subject] = [];
      subjectMap[t.subject].push(
        Math.round((t.marksObtained / t.totalMarks) * 100)
      );
    });

    const subjectAnalysis = Object.entries(subjectMap).map(([subject, pcts]) => ({
      subject,
      avgPct: Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length),
      tests:  pcts.length,
      best:   Math.max(...pcts),
      worst:  Math.min(...pcts)
    }));

    const trend = [...tests].slice(0, 10).reverse().map(t => ({
      date:    t.testDate,
      subject: t.subject,
      pct:     Math.round((t.marksObtained / t.totalMarks) * 100)
    }));

    res.json({
      success: true,
      tests,
      analytics: {
        totalTests: tests.length,
        overallAvg,
        highestScore,
        lowestScore,
        subjectAnalysis,
        trend
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Tests error', error: error.message });
  }
};

// @route PUT /api/parent/fcm-token
const updateFcmToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    await Student.findByIdAndUpdate(
      req.student._id,
      { parentFcmToken: fcmToken }
    );
    res.json({ success: true, message: 'FCM token updated' });
  } catch (error) {
    res.status(500).json({ message: 'FCM token error', error: error.message });
  }
};

module.exports = {
  parentLogin,
  parentProtect,
  getDashboard,
  getAttendance,
  getFees,
  getTests,
  updateFcmToken
};