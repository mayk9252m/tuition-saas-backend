const express = require('express');
const router = express.Router();
const { markAttendance, getAttendance, markBulkAttendance, getTodayAttendance } = require('../controllers/attendanceController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/today', getTodayAttendance);
router.post('/bulk', markBulkAttendance);
router.route('/:studentId').get(getAttendance).post(markAttendance);

module.exports = router;
