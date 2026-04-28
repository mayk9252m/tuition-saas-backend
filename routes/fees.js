const express = require('express');
const router = express.Router();
const { updateFeeStatus, getFeesSummary, sendManualReminder } = require('../controllers/feesController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/summary', getFeesSummary);
router.post('/remind/:studentId', sendManualReminder);
router.put('/:studentId/:month', updateFeeStatus);

module.exports = router;
