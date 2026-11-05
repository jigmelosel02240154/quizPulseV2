const { initializeApp, cert, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const credential = process.env.FIREBASE_SERVICE_ACCOUNT
  ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  : applicationDefault();

initializeApp({ credential });

// `admin.auth()` is kept so the other files don't need to change
const admin = { auth: () => getAuth() };

module.exports = { admin, db: getFirestore(), FieldValue };