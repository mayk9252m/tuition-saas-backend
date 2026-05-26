const express = require('express');
const router  = express.Router();
const {
  parentLogin,
  parentProtect,
  getDashboard,
  getAttendance,
  getFees,
  getTests,
  updateFcmToken
} = require('../controllers/parentController');

router.post('/login',      parentLogin);
router.get('/dashboard',   parentProtect, getDashboard);
router.get('/attendance',  parentProtect, getAttendance);
router.get('/fees',        parentProtect, getFees);
router.get('/tests',       parentProtect, getTests);
router.put('/fcm-token',   parentProtect, updateFcmToken);

module.exports = router;