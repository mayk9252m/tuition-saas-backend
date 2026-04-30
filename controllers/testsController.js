const Student = require('../models/Student');

// @desc    Add a test result for a student
// @route   POST /api/tests/:studentId
const addTestResult = async (req, res) => {
  try {
    const { testDate, subject, chapterSyllabus, marksObtained, totalMarks, remarks } = req.body;

    if (!testDate || !subject || !chapterSyllabus || marksObtained === undefined || !totalMarks) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    if (Number(marksObtained) > Number(totalMarks)) {
      return res.status(400).json({ message: 'Marks obtained cannot exceed total marks' });
    }

    const student = await Student.findOne({ _id: req.params.studentId, userId: req.user._id });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    student.testResults.push({
      testDate, subject, chapterSyllabus,
      marksObtained: Number(marksObtained),
      totalMarks: Number(totalMarks),
      remarks: remarks || ''
    });

    await student.save();
    res.status(201).json({ success: true, message: 'Test result added', testResults: student.testResults });
  } catch (error) {
    res.status(500).json({ message: 'Error adding test result', error: error.message });
  }
};

// @desc    Get all test results for a student
// @route   GET /api/tests/:studentId
const getStudentTests = async (req, res) => {
  try {
    const { subject, from, to } = req.query;

    const student = await Student.findOne({ _id: req.params.studentId, userId: req.user._id });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    let tests = [...student.testResults].sort((a, b) => new Date(b.testDate) - new Date(a.testDate));

    if (subject) tests = tests.filter(t => t.subject.toLowerCase().includes(subject.toLowerCase()));
    if (from) tests = tests.filter(t => t.testDate >= from);
    if (to) tests = tests.filter(t => t.testDate <= to);

    // Per-subject analysis
    const subjectMap = {};
    student.testResults.forEach(t => {
      if (!subjectMap[t.subject]) subjectMap[t.subject] = [];
      subjectMap[t.subject].push({ obtained: t.marksObtained, total: t.totalMarks, pct: Math.round((t.marksObtained / t.totalMarks) * 100) });
    });

    const subjectAnalysis = Object.entries(subjectMap).map(([subj, results]) => {
      const avgPct = Math.round(results.reduce((a, r) => a + r.pct, 0) / results.length);
      const best = Math.max(...results.map(r => r.pct));
      const worst = Math.min(...results.map(r => r.pct));
      return { subject: subj, tests: results.length, avgPct, best, worst };
    });

    // Overall stats
    const allPcts = student.testResults.map(t => Math.round((t.marksObtained / t.totalMarks) * 100));
    const overallAvg = allPcts.length ? Math.round(allPcts.reduce((a, b) => a + b, 0) / allPcts.length) : 0;
    const highestScore = allPcts.length ? Math.max(...allPcts) : 0;
    const lowestScore = allPcts.length ? Math.min(...allPcts) : 0;

    // Trend (last 10 tests chronologically)
    const trend = [...student.testResults]
      .sort((a, b) => new Date(a.testDate) - new Date(b.testDate))
      .slice(-10)
      .map(t => ({
        date: t.testDate,
        subject: t.subject,
        pct: Math.round((t.marksObtained / t.totalMarks) * 100)
      }));

    res.json({
      success: true,
      student: { _id: student._id, studentName: student.studentName, class: student.class, school: student.school },
      tests,
      analytics: {
        totalTests: student.testResults.length,
        overallAvg,
        highestScore,
        lowestScore,
        subjectAnalysis,
        trend
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching test results', error: error.message });
  }
};

// @desc    Delete a test result
// @route   DELETE /api/tests/:studentId/:testId
const deleteTestResult = async (req, res) => {
  try {
    const student = await Student.findOne({ _id: req.params.studentId, userId: req.user._id });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const index = student.testResults.findIndex(t => t._id.toString() === req.params.testId);
    if (index === -1) return res.status(404).json({ message: 'Test record not found' });

    student.testResults.splice(index, 1);
    await student.save();

    res.json({ success: true, message: 'Test result deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting test result', error: error.message });
  }
};

// @desc    Get all students summary (for Tests home page cards)
// @route   GET /api/tests
const getAllStudentsTestSummary = async (req, res) => {
  try {
    const { filterClass, filterSubject } = req.query;

    let query = { userId: req.user._id, isActive: true };
    if (filterClass) query.class = filterClass;

    const students = await Student.find(query).sort({ studentName: 1 });

    const summary = students.map(student => {
      let tests = student.testResults;
      if (filterSubject) {
        tests = tests.filter(t => t.subject.toLowerCase().includes(filterSubject.toLowerCase()));
      }

      const allPcts = tests.map(t => Math.round((t.marksObtained / t.totalMarks) * 100));
      const avg = allPcts.length ? Math.round(allPcts.reduce((a, b) => a + b, 0) / allPcts.length) : null;
      const latest = [...tests].sort((a, b) => new Date(b.testDate) - new Date(a.testDate))[0] || null;
      const subjects = [...new Set(tests.map(t => t.subject))];

      // Performance grade
      let grade = '—';
      if (avg !== null) {
        if (avg >= 90) grade = 'A+';
        else if (avg >= 80) grade = 'A';
        else if (avg >= 70) grade = 'B+';
        else if (avg >= 60) grade = 'B';
        else if (avg >= 50) grade = 'C';
        else grade = 'D';
      }

      return {
        _id: student._id,
        studentName: student.studentName,
        class: student.class,
        school: student.school,
        totalTests: tests.length,
        avgScore: avg,
        grade,
        highestScore: allPcts.length ? Math.max(...allPcts) : null,
        lowestScore: allPcts.length ? Math.min(...allPcts) : null,
        subjects,
        latestTest: latest ? {
          subject: latest.subject,
          testDate: latest.testDate,
          pct: Math.round((latest.marksObtained / latest.totalMarks) * 100)
        } : null
      };
    });

    // Class-wide analytics
    const classAnalytics = {};
    summary.forEach(s => {
      if (!classAnalytics[s.class]) classAnalytics[s.class] = [];
      if (s.avgScore !== null) classAnalytics[s.class].push(s.avgScore);
    });

    const classAvgs = Object.entries(classAnalytics).map(([cls, avgs]) => ({
      class: `Class ${cls}`,
      avg: avgs.length ? Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length) : 0
    }));

    res.json({ success: true, students: summary, classAvgs });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching test summary', error: error.message });
  }
};

module.exports = { addTestResult, getStudentTests, deleteTestResult, getAllStudentsTestSummary };
