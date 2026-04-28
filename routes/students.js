const express = require('express');
const router = express.Router();
const { getStudents, getStudent, createStudent, deleteStudent, updateStudent } = require('../controllers/studentsController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/').get(getStudents).post(createStudent);
router.route('/:id').get(getStudent).put(updateStudent).delete(deleteStudent);

module.exports = router;
