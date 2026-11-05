const test = require('node:test');
const assert = require('node:assert');
const { getCollege, emailMatches, eligibleColleges, checkCampus } = require('../src/colleges');

const cst = getCollege('CST');

test('accepts a CST student email', () => assert.ok(emailMatches('02230123.cst@rub.edu.bt', cst)));
test('is case-insensitive', () => assert.ok(emailMatches('02230123.CST@RUB.edu.bt', cst)));
test('accepts dots in the student part', () => assert.ok(emailMatches('a.b.cst@rub.edu.bt', cst)));
test('rejects personal emails', () => assert.ok(!emailMatches('me@gmail.com', cst)));
test('rejects another college tag', () => assert.ok(!emailMatches('123.gcbs@rub.edu.bt', cst)));
test('rejects a look-alike domain', () => assert.ok(!emailMatches('123.cst@rub.edu.bt.evil.com', cst)));
test('rejects a second @ trick', () => assert.ok(!emailMatches('x@evil.com.cst@rub.edu.bt', cst)));
test('rejects an empty student part', () => assert.ok(!emailMatches('.cst@rub.edu.bt', cst)));
test('eligibleColleges lists matching colleges only', () => {
  assert.deepStrictEqual(eligibleColleges('02230123.cst@rub.edu.bt').map((c) => c.id), ['CST']);
  assert.deepStrictEqual(eligibleColleges('me@gmail.com'), []);
});

test('checkCampus: no campus is always allowed', () => {
  assert.deepStrictEqual(checkCampus({ email: 'me@gmail.com' }, null), { ok: true, campus: null });
});
test('checkCampus: matching email is allowed', () => {
  assert.strictEqual(checkCampus({ email: '1.cst@rub.edu.bt' }, 'CST').campus, 'CST');
});
test('checkCampus: wrong email is refused', () => {
  const r = checkCampus({ email: 'me@gmail.com' }, 'CST');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.status, 403);
});
test('checkCampus: unknown college is refused', () => {
  assert.strictEqual(checkCampus({ email: '1.cst@rub.edu.bt' }, 'NOPE').status, 400);
});
test('checkCampus: unverified email is refused when verification is required', () => {
  const r = checkCampus({ email: '1.cst@rub.edu.bt', emailVerified: false }, 'CST', true);
  assert.strictEqual(r.code, 'verify_email');
  assert.strictEqual(checkCampus({ email: '1.cst@rub.edu.bt', emailVerified: true }, 'CST', true).ok, true);
});
