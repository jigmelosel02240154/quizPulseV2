// ---------------------------------------------------------------------------
// COLLEGES: to add a college, add ONE line to the list below. Nothing else changes.
//   id        short code stored in the database and used for the leaderboard tab
//   name      full name shown in the app
//   emailTag  students' emails look like  <student-id>.<emailTag>@rub.edu.bt
//             e.g. CST -> 02230123.cst@rub.edu.bt
// ---------------------------------------------------------------------------
const EMAIL_DOMAIN = 'rub.edu.bt';

const COLLEGES = [
  { id: 'CST', name: 'College of Science and Technology', emailTag: 'cst' },
  // Examples for later. Check each college's REAL email format before enabling one:
  // { id: 'SHERUBTSE', name: 'Sherubtse College', emailTag: 'sherubtse' },
  // { id: 'CNR', name: 'College of Natural Resources', emailTag: 'cnr' },
  // { id: 'GCBS', name: 'Gedu College of Business Studies', emailTag: 'gcbs' },
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getCollege = (id) => COLLEGES.find((c) => c.id === id);
const emailHint = (c) => `.${c.emailTag}@${EMAIL_DOMAIN}`;

function emailMatches(email, college) {
  if (!email || !college) return false;
  const re = new RegExp(`^[^@\\s]+\\.${escapeRe(college.emailTag)}@${escapeRe(EMAIL_DOMAIN)}$`, 'i');
  return re.test(String(email).trim());
}

const eligibleColleges = (email) => COLLEGES.filter((c) => emailMatches(email, c));
const publicList = () => COLLEGES.map((c) => ({ id: c.id, name: c.name, emailHint: emailHint(c) }));

/**
 * Decides whether a user may hold a campus.
 * Returns { ok:true, campus } (campus is null for "no campus") or { ok:false, status, error, code? }.
 */
function checkCampus({ email, emailVerified }, campusId, requireVerified = false) {
  if (!campusId) return { ok: true, campus: null };
  const college = getCollege(campusId);
  if (!college) return { ok: false, status: 400, error: 'Unknown college' };
  if (!emailMatches(email, college)) {
    return { ok: false, status: 403, error: `To join ${college.id} you need your college email (ending ${emailHint(college)}).` };
  }
  if (requireVerified && !emailVerified) {
    return { ok: false, status: 403, code: 'verify_email', error: 'Please verify your email first (check your inbox), then choose your campus.' };
  }
  return { ok: true, campus: college.id };
}

module.exports = { COLLEGES, EMAIL_DOMAIN, getCollege, emailHint, emailMatches, eligibleColleges, publicList, checkCampus };
