import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { api } from '../api';
import { Button, Card, Loading, ui } from '../components/UI';
import { colors, QUESTION_MS, BADGES } from '../theme';

export default function SinglePlayerScreen({ route, navigation }) {
  const { subject, difficulty } = route.params;
  const [qs, setQs] = useState(null);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [remaining, setRemaining] = useState(QUESTION_MS);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [newBadges, setNewBadges] = useState([]);
  const remainingRef = useRef(QUESTION_MS);
  const stats = useRef({});
  const correctCount = useRef(0);
  const scoreRef = useRef(0);
  const chooseRef = useRef();

  useEffect(() => {
    api(`/questions?subject=${encodeURIComponent(subject)}&difficulty=${difficulty}&limit=10`)
      .then((data) => (data.length ? setQs(data) : (Alert.alert('No questions', 'Nothing found for this selection.'), navigation.goBack())))
      .catch((e) => { Alert.alert('Error', e.message); navigation.goBack(); });
  }, []);

  // Countdown for the current question
  useEffect(() => {
    if (!qs || done || picked !== null) return;
    const end = Date.now() + QUESTION_MS;
    const t = setInterval(() => {
      const r = Math.max(0, end - Date.now());
      remainingRef.current = r;
      setRemaining(r);
      if (r === 0) { clearInterval(t); chooseRef.current(-1); }
    }, 100);
    return () => clearInterval(t);
  }, [qs, idx, done, picked]);

  const finish = async () => {
    setDone(true);
    try {
      const res = await api('/singleplayer/result', { method: 'POST', body: { subjectStats: stats.current, score: scoreRef.current } });
      setNewBadges(res.newBadges || []);
    } catch (e) { /* offline: results just won't sync */ }
  };

  chooseRef.current = (i) => {
    if (picked !== null || !qs) return;
    const q = qs[idx];
    const ok = i === q.correctIndex;
    const s = stats.current[q.subject] || (stats.current[q.subject] = { correct: 0, total: 0 });
    s.total++;
    if (ok) {
      s.correct++; correctCount.current++;
      const pts = 100 + Math.round((remainingRef.current / QUESTION_MS) * 50);
      scoreRef.current += pts;
      setScore(scoreRef.current);
    }
    setPicked(i);
    setTimeout(() => {
      if (idx + 1 >= qs.length) finish();
      else { setIdx(idx + 1); setPicked(null); remainingRef.current = QUESTION_MS; setRemaining(QUESTION_MS); }
    }, 1200);
  };

  if (!qs) return <Loading />;

  if (done) {
    return (
      <View style={[ui.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 56 }}>{correctCount.current === qs.length ? '🎯' : '🎉'}</Text>
        <Text style={ui.h1}>{correctCount.current} / {qs.length} correct</Text>
        <Text style={[ui.text, { marginVertical: 8 }]}>⭐ {score} points</Text>
        {newBadges.map((b) => <Text key={b} style={{ color: colors.accent, marginTop: 4 }}>New badge: {BADGES[b]?.icon} {BADGES[b]?.label}</Text>)}
        <View style={{ width: '100%', marginTop: 24 }}>
          <Button title="Back home" onPress={() => navigation.goBack()} />
        </View>
      </View>
    );
  }

  const q = qs[idx];
  return (
    <View style={ui.screen}>
      <View style={s.top}><Text style={ui.muted}>Question {idx + 1}/{qs.length}</Text><Text style={{ color: colors.accent, fontWeight: '700' }}>⭐ {score}</Text></View>
      <View style={s.track}><View style={[s.fill, { width: `${(remaining / QUESTION_MS) * 100}%`, backgroundColor: remaining < 5000 ? colors.bad : colors.primary }]} /></View>
      <Text style={s.question}>{q.text}</Text>
      {q.options.map((o, i) => {
        let bg = colors.card;
        if (picked !== null) { if (i === q.correctIndex) bg = colors.good; else if (i === picked) bg = colors.bad; }
        return (
          <TouchableOpacity key={i} style={[s.option, { backgroundColor: bg }]} onPress={() => chooseRef.current(i)}>
            <Text style={ui.text}>{o}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  track: { height: 8, backgroundColor: colors.card2, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  question: { color: colors.text, fontSize: 22, fontWeight: '700', marginVertical: 24 },
  option: { padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
});
