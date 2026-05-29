const Student = require('../models/Student');

// @desc    Get all students for logged-in user
// @route   GET /api/students
const getStudents = async (req, res) => {
  try {
    const students = await Student.find({ userId: req.user._id, isActive: true })
      .sort({ createdAt: -1 });

    // Auto-generate missing monthly fees for each student
    for (const student of students) {
      const newFees = student.generateMonthlyFees();
      if (newFees.length > 0) {
        student.feesHistory.push(...newFees);
        await student.save();
      }
    }

    res.json({ success: true, count: students.length, students });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching students', error: error.message });
  }
};

// @desc    Get single student
// @route   GET /api/students/:id
const getStudent = async (req, res) => {
  try {
    const student = await Student.findOne({ _id: req.params.id, userId: req.user._id });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.json({ success: true, student });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching student', error: error.message });
  }
};

// @desc    Create student
// @route   POST /api/students
const createStudent = async (req, res) => {
  try {
    const {
      studentName, fatherName, motherName, class: studentClass,
      school, whatsappNumber, dateOfJoining, monthlyFees
    } = req.body;

    const student = new Student({
      userId: req.user._id,
      studentName,
      fatherName,
      motherName,
      class: studentClass,
      school,
      whatsappNumber,
      dateOfJoining,
      monthlyFees
    });

    // Generate fees from joining date to current month
    const initialFees = student.generateMonthlyFees();
    student.feesHistory.push(...initialFees);

    await student.save();

    res.status(201).json({ success: true, student });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: 'Error creating student', error: error.message });
  }
};

// @desc    Delete student (soft delete)
// @route   DELETE /api/students/:id
const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findOne({ _id: req.params.id, userId: req.user._id });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    student.isActive = false;
    await student.save();

    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting student', error: error.message });
  }
};

// @desc    Update student
// @route   PUT /api/students/:id
const updateStudent = async (req, res) => {
  try {
    const student = await Student.findOne({ _id: req.params.id, userId: req.user._id });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const allowedFields = ['studentName', 'fatherName', 'motherName', 'class', 'school', 'whatsappNumber', 'monthlyFees'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        student[field] = req.body[field];
      }
    });

    await student.save();
    res.json({ success: true, student });
  } catch (error) {
    res.status(500).json({ message: 'Error updating student', error: error.message });
  }
};

module.exports = { getStudents, getStudent, createStudent, deleteStudent, updateStudent };
