const admin = require('firebase-admin');
const path  = require('path');

// Initialize Firebase Admin (only once)
let initialized = false;

const initializeFirebase = () => {
  if (initialized) return;
  try {
    const serviceAccount = require(
      path.join(__dirname, '../firebase-service-account.json')
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    initialized = true;
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.error('❌ Firebase Admin init failed:', error.message);
  }
};

// Send notification to a single student's parent
const sendToParent = async (fcmToken, title, body, type = 'general') => {
  if (!fcmToken) return;
  initializeFirebase();
  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: { type },
      android: {
        priority: 'high',
        notification: {
          channelId: getChannelId(type),
          priority:  'high',
          defaultSound: true
        }
      }
    });
    console.log(`✅ Notification sent: ${title}`);
  } catch (error) {
    // Token expired or invalid — clear it
    if (error.code === 'messaging/registration-token-not-registered') {
      console.log('🗑️ Invalid FCM token, clearing...');
      const Student = require('../models/Student');
      await Student.findOneAndUpdate(
        { parentFcmToken: fcmToken },
        { parentFcmToken: '' }
      );
    } else {
      console.error('❌ Notification error:', error.message);
    }
  }
};

// Send to multiple students
const sendToMultiple = async (students, title, body, type = 'general') => {
  const promises = students
    .filter(s => s.parentFcmToken)
    .map(s => sendToParent(s.parentFcmToken, title, body, type));
  await Promise.allSettled(promises);
};

const getChannelId = (type) => {
  switch (type) {
    case 'fee_reminder':
    case 'fee_paid':     return 'fee_reminders';
    case 'test_result':  return 'test_results';
    case 'attendance':   return 'attendance_alerts';
    default:             return 'tuition_notifications';
  }
};

module.exports = { sendToParent, sendToMultiple };