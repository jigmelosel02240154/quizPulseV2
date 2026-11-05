// Usage: npm run make-admin -- someone@example.com
// Gives an existing Firebase user the admin claim (needed for /api/admin/questions).
require('dotenv').config();
const { admin } = require('../src/firebase');

(async () => {
  const email = process.argv[2];
  if (!email) { console.error('Usage: npm run make-admin -- <email>'); process.exit(1); }
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });
  console.log(`${email} is now an admin. They must sign out and in again for it to apply.`);
  process.exit(0);
})();
