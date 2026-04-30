const express = require('express');
const router = express.Router();
const {
  addTestResult,
  getStudentTests,
  deleteTestResult,
  getAllStudentsTestSummary
} = require('../controllers/testsController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getAllStudentsTestSummary);
router.post('/:studentId', addTestResult);
router.get('/:studentId', getStudentTests);
router.delete('/:studentId/:testId', deleteTestResult);

module.exports = router;
