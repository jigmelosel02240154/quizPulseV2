// Deletes ALL users (Firebase Auth accounts + Firestore "users" profiles) and ALL "matches".
// Questions are kept unless you add --questions.
//
// Usage (run from the server folder):
//   node scripts/reset-data.js                       dry run: only shows what WOULD be deleted
//   node scripts/reset-data.js --yes                 delete users and matches (asks you to confirm)
//   node scripts/reset-data.js --yes --questions     also delete the questions
//
// THIS CANNOT BE UNDONE.
require('dotenv').config();
const fs = require('fs');
const readline = require('readline');
const { admin, db } = require('../src/firebase');

const args = process.argv.slice(2);
const YES = args.includes('--yes');
const WITH_QUESTIONS = args.includes('--questions');

function projectId() {
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT || fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8');
    return JSON.parse(raw).project_id || 'unknown';
  } catch { return 'unknown'; }
}

async function listAllUids() {
  const uids = [];
  let token;
  do {
    const page = await admin.auth().listUsers(1000, token);
    page.users.forEach((u) => uids.push(u.uid));
    token = page.pageToken;
  } while (token);
  return uids;
}

const countDocs = async (name) => (await db.collection(name).count().get()).data().count;

(async () => {
  const pid = projectId();
  const collections = ['users', 'matches', ...(WITH_QUESTIONS ? ['questions'] : [])];
  const uids = await listAllUids();

  console.log(`\nFirebase project: ${pid}`);
  console.log(`Login accounts (Authentication): ${uids.length}`);
  for (const c of collections) console.log(`Firestore "${c}": ${await countDocs(c)} documents`);
  if (!WITH_QUESTIONS) console.log('Questions are kept (add --questions to delete them too).');

  if (!YES) {
    console.log('\nDry run only. Nothing was deleted. Re-run with --yes to delete.');
    process.exit(0);
  }

  const word = pid !== 'unknown' ? pid : 'DELETE';
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((r) => rl.question(`\nThis cannot be undone. Type "${word}" to confirm: `, r));
  rl.close();
  if (answer.trim() !== word) { console.log('Did not match. Nothing was deleted.'); process.exit(1); }

  for (let i = 0; i < uids.length; i += 1000) {
    const res = await admin.auth().deleteUsers(uids.slice(i, i + 1000));
    console.log(`Deleted ${res.successCount} login accounts${res.failureCount ? `, ${res.failureCount} failed` : ''}`);
  }
  for (const c of collections) {
    await db.recursiveDelete(db.collection(c));
    console.log(`Deleted Firestore collection "${c}"`);
  }
  console.log('\nDone. Restart the server, then register your accounts again.');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
