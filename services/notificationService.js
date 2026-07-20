const admin = require('firebase-admin');
const path  = require('path');

let initialized = false;

const initializeFirebase = () => {
  if (initialized) return true;
  try {
    // Check if already initialized
    if (admin.apps.length > 0) {
      initialized = true;
      return true;
    }

    const serviceAccountPath = path.join(
      __dirname, '../firebase-service-account.json'
    );

    const serviceAccount = require(serviceAccountPath);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    initialized = true;
    console.log('✅ Firebase Admin SDK initialized');
    return true;
  } catch (error) {
    console.error('❌ Firebase Admin init failed:', error.message);
    console.error('Make sure firebase-service-account.json exists in backend folder');
    return false;
  }
};

// Send to single parent
const sendToParent = async (fcmToken, title, body, type = 'general') => {
  if (!fcmToken || fcmToken === '') {
    console.log('⚠️ No FCM token for this student — skipping notification');
    return;
  }

  const ready = initializeFirebase();
  if (!ready) return;

  try {
    const channelId = getChannelId(type);

    const response = await admin.messaging().send({
      token: fcmToken,
      notification: {
        title,
        body
      },
      data: {
        type,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      android: {
        priority: 'high',
        notification: {
          channelId,
          priority:     'high',
          defaultSound: true,
          defaultVibrateTimings: true
        }
      }
    });

    console.log(`✅ Notification sent successfully: ${title} → ${response}`);
    return response;
  } catch (error) {
    console.error(`❌ Failed to send notification: ${error.message}`);

    // Token is invalid — clear it from database
    if (
      error.code === 'messaging/registration-token-not-registered' ||
      error.code === 'messaging/invalid-registration-token'
    ) {
      console.log('🗑️ Clearing invalid FCM token...');
      try {
        const Student = require('../models/Student');
        await Student.findOneAndUpdate(
          { parentFcmToken: fcmToken },
          { parentFcmToken: '' }
        );
      } catch (dbError) {
        console.error('DB error clearing token:', dbError.message);
      }
    }
  }
};

// Send to multiple parents
const sendToMultiple = async (students, title, body, type = 'general') => {
  const studentsWithTokens = students.filter(
    s => s.parentFcmToken && s.parentFcmToken !== ''
  );

  console.log(
    `📱 Sending notifications to ${studentsWithTokens.length} parents...`
  );

  const promises = studentsWithTokens.map(s =>
    sendToParent(s.parentFcmToken, title, body, type)
  );

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

module.exports = { sendToParent, sendToMultiple, initializeFirebase };