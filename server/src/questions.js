const { db } = require('./firebase');

const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

async function sampleQuestions({ subject, difficulty, count }) {
  let q = db.collection('questions');
  if (subject && subject !== 'Mixed') q = q.where('subject', '==', subject);
  if (difficulty && difficulty !== 'any') q = q.where('difficulty', '==', difficulty);
  const snap = await q.limit(150).get();
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return shuffle(all).slice(0, count);
}

module.exports = { sampleQuestions };
