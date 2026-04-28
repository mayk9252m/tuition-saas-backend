const Student = require('../models/Student');

// @desc    Get analytics data
// @route   GET /api/analytics
const getAnalytics = async (req, res) => {
  try {
    const students = await Student.find({ userId: req.user._id, isActive: true });

    // Students by class
    const byClass = {};
    students.forEach(s => {
      byClass[`Class ${s.class}`] = (byClass[`Class ${s.class}`] || 0) + 1;
    });

    // Students by school
    const bySchool = {};
    students.forEach(s => {
      bySchool[s.school] = (bySchool[s.school] || 0) + 1;
    });

    // Monthly fees trend (last 6 months)
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthName = d.toLocaleString('default', { month: 'short', year: '2-digit' });

      let collected = 0;
      let pending = 0;

      students.forEach(student => {
        const fee = student.feesHistory.find(f => f.month === monthKey);
        if (fee) {
          if (fee.status === 'paid') collected += fee.amount;
          else pending += fee.amount;
        }
      });

      monthlyTrend.push({ month: monthName, collected, pending });
    }

    // Today's attendance
    const today = new Date().toISOString().split('T')[0];
    let presentToday = 0;
    let absentToday = 0;

    students.forEach(s => {
      const todayRecord = s.attendance.find(a => a.date === today);
      if (todayRecord) {
        if (todayRecord.status === 'present') presentToday++;
        else absentToday++;
      }
    });

    // Total fees
    let totalCollected = 0;
    let totalPending = 0;
    students.forEach(s => {
      s.feesHistory.forEach(f => {
        if (f.status === 'paid') totalCollected += f.amount;
        else totalPending += f.amount;
      });
    });

    // Attendance rate per student (last 30 days)
    const attendanceRate = students.map(s => {
      const last30 = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        last30.push(dateStr);
      }

      const marked = s.attendance.filter(a => last30.includes(a.date));
      const present = marked.filter(a => a.status === 'present').length;
      const rate = marked.length > 0 ? Math.round((present / marked.length) * 100) : 0;

      return {
        name: s.studentName,
        class: s.class,
        rate,
        present,
        total: marked.length
      };
    });

    res.json({
      success: true,
      analytics: {
        totalStudents: students.length,
        presentToday,
        absentToday,
        notMarkedToday: students.length - presentToday - absentToday,
        totalCollected,
        totalPending,
        byClass: Object.entries(byClass).map(([name, value]) => ({ name, value })),
        bySchool: Object.entries(bySchool).map(([name, value]) => ({ name, value })),
        monthlyTrend,
        attendanceRate
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching analytics', error: error.message });
  }
};

module.exports = { getAnalytics };
