import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Share } from 'react-native';
import { getSocket, measureLatency, closeSocket } from '../socket';
import { auth } from '../firebase';
import { Button, Card, ui } from '../components/UI';
import { colors, BADGES } from '../theme';

const EVENTS = ['lobby_update', 'searching', 'match_start', 'question_start', 'score_update', 'question_end', 'match_end', 'badges_earned', 'match_error', 'resume', 'connect', 'disconnect'];

// Phases: connecting -> searching | lobby -> playing -> ended
export default function RoomScreen({ route, navigation }) {
  const { mode, subject, difficulty, questionCount, code: joinCode } = route.params;
  const me = auth.currentUser.uid;

  const [phase, setPhase] = useState('connecting');
  const phaseRef = useRef('connecting');
  const go = (p) => { phaseRef.current = p; setPhase(p); };

  const [lobby, setLobby] = useState({ code: '', host: '', players: [] });
  const [question, setQuestion] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [picked, setPicked] = useState(null);
  const [correctIndex, setCorrectIndex] = useState(null);
  const [scores, setScores] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [newBadges, setNewBadges] = useState([]);
  const [latency, setLatency] = useState(null);
  const [online, setOnline] = useState(true);
  const socketRef = useRef(null);
  const timerRef = useRef(null);
  const durationRef = useRef(15000);

  const stopCountdown = () => clearInterval(timerRef.current);
  const startCountdown = (ms) => {
    stopCountdown();
    durationRef.current = Math.max(ms, 1);
    const end = Date.now() + ms;
    setRemaining(ms);
    timerRef.current = setInterval(() => setRemaining(Math.max(0, end - Date.now())), 100);
  };

  // Ask for confirmation before abandoning a running match (counts as a forfeit).
  useEffect(() => navigation.addListener('beforeRemove', (e) => {
    if (phaseRef.current !== 'playing') return;
    e.preventDefault();
    Alert.alert('Leave match?', 'You will forfeit this match.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
    ]);
  }), [navigation]);

  useEffect(() => {
    let latencyTimer;
    let s;
    const handlers = {
      lobby_update: (l) => {
        setLobby(l); setScores(l.players);
        if (phaseRef.current !== 'playing' && phaseRef.current !== 'ended') go('lobby');
      },
      searching: () => go('searching'),
      match_start: () => go('playing'),
      question_start: (q) => { go('playing'); setQuestion(q); setPicked(null); setCorrectIndex(null); startCountdown(q.durationMs); },
      score_update: ({ scores }) => setScores(scores),
      question_end: ({ correctIndex, scores }) => { stopCountdown(); setCorrectIndex(correctIndex); setScores(scores); },
      match_end: ({ ranking }) => { stopCountdown(); setRanking(ranking); go('ended'); },
      badges_earned: (b) => setNewBadges(b),
      match_error: ({ message }) => { Alert.alert('Match cancelled', message); navigation.goBack(); },
      // Sent by the server when we reconnect to a match that is still running
      resume: (r) => {
        setLobby(r); setScores(r.players);
        if (r.state === 'playing') {
          go('playing');
          if (r.question) { setQuestion(r.question); setCorrectIndex(null); setPicked(r.answered ? -1 : null); startCountdown(r.question.durationMs); }
        } else go('lobby');
      },
      connect: () => {
        setOnline(true);
        if (phaseRef.current === 'searching') s.emit('quick_match', { subject, difficulty });
      },
      disconnect: () => setOnline(false),
    };

    (async () => {
      try {
        s = await getSocket();
        socketRef.current = s;
        EVENTS.forEach((e) => s.on(e, handlers[e]));
        const ping = () => measureLatency(s).then(setLatency);
        ping();
        latencyTimer = setInterval(() => s.connected && ping(), 5000);

        if (mode === 'quick') s.emit('quick_match', { subject, difficulty });
        if (mode === 'create') s.emit('create_room', { subject, difficulty, questionCount });
        if (mode === 'join') s.emit('join_room', { code: joinCode }, (r) => {
          if (r?.error) { Alert.alert('Cannot join', r.error); navigation.goBack(); }
        });
      } catch (e) {
        closeSocket();
        Alert.alert('Connection failed', e.message === 'profile_missing' ? 'Your profile is incomplete.' : 'Could not reach the game server.');
        navigation.goBack();
      }
    })();

    return () => {
      clearInterval(latencyTimer);
      stopCountdown();
      if (s) { s.emit('leave_room'); EVENTS.forEach((e) => s.off(e, handlers[e])); }
    };
  }, []);

  const answer = (i) => {
    if (picked !== null || correctIndex !== null) return;
    setPicked(i);
    socketRef.current.emit('submit_answer', { choice: i });
  };

  const Banner = () => (!online ? <Text style={s.offline}>Reconnecting...</Text> : null);

  if (phase === 'connecting' || phase === 'searching') {
    return (
      <View style={[ui.screen, s.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[ui.text, { marginTop: 16 }]}>{phase === 'searching' ? 'Searching for an opponent...' : 'Connecting...'}</Text>
        {phase === 'searching' && <Button title="Cancel" variant="ghost" style={{ marginTop: 24, width: 160 }} onPress={() => { socketRef.current?.emit('cancel_search'); navigation.goBack(); }} />}
      </View>
    );
  }

  if (phase === 'lobby') {
    const isHost = lobby.host === me;
    return (
      <View style={[ui.screen, s.center]}>
        <Banner />
        <Text style={ui.muted}>Room code</Text>
        <Text style={s.code}>{lobby.code}</Text>
        <Text style={ui.muted}>{lobby.subject} · {lobby.difficulty === 'any' ? 'any difficulty' : lobby.difficulty} · {lobby.questionCount} questions</Text>
        <Card style={{ width: '100%', marginTop: 20 }}>
          {lobby.players.map((p) => (
            <Text key={p.uid} style={[ui.text, { marginVertical: 4 }]}>{p.avatar} {p.name}{p.uid === lobby.host ? '  👑' : ''}</Text>
          ))}
        </Card>
        <Button title="📤  Share code" variant="ghost" style={{ width: '100%' }} onPress={() => Share.share({ message: `Join my QuizPulse room! Code: ${lobby.code}` })} />
        {isHost
          ? <Button title="Start match" style={{ width: '100%' }} onPress={() => socketRef.current.emit('start_room')} />
          : <Text style={ui.muted}>Waiting for the host to start...</Text>}
        {latency !== null && <Text style={[ui.muted, { marginTop: 12 }]}>Latency: {latency} ms</Text>}
      </View>
    );
  }

  if (phase === 'ended') {
    const winner = ranking[0] && !ranking[0].left && ranking.length > 1 ? ranking[0] : null;
    const medals = ['🥇', '🥈', '🥉'];
    return (
      <View style={[ui.screen, s.center]}>
        <Text style={{ fontSize: 56 }}>{winner?.uid === me ? '🏆' : '🏁'}</Text>
        <Text style={ui.h1}>{winner ? (winner.uid === me ? 'You won!' : `${winner.name} wins`) : 'Match finished'}</Text>
        <Card style={{ width: '100%', marginTop: 20 }}>
          {ranking.map((p, i) => (
            <View key={p.uid} style={s.rankRow}>
              <Text style={ui.text}>{medals[i] || `${i + 1}.`} {p.avatar} {p.name}{p.left ? ' (left)' : ''}</Text>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>{p.score}</Text>
            </View>
          ))}
        </Card>
        {newBadges.map((b) => <Text key={b} style={{ color: colors.accent, marginBottom: 4 }}>New badge: {BADGES[b]?.icon} {BADGES[b]?.label}</Text>)}
        <Button title="Back home" style={{ width: '100%', marginTop: 16 }} onPress={() => navigation.goBack()} />
      </View>
    );
  }

  if (!question) return <View style={[ui.screen, s.center]}><Banner /><Text style={ui.text}>Get ready...</Text></View>;

  return (
    <View style={ui.screen}>
      <Banner />
      <View style={s.scoreRow}>
        {scores.map((p) => (
          <View key={p.uid} style={s.scoreBox}>
            <Text style={ui.muted}>{p.avatar} {p.name}{!p.connected && !p.left ? ' ⚠' : ''}{p.left ? ' (left)' : ''}</Text>
            <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 18 }}>{p.score}{p.answered ? ' ✓' : ''}</Text>
          </View>
        ))}
      </View>
      <View style={s.top}>
        <Text style={ui.muted}>Question {question.index + 1}/{question.total}</Text>
        <Text style={ui.muted}>{latency !== null ? `${latency} ms` : ''}</Text>
      </View>
      <View style={s.track}><View style={[s.fill, { width: `${(remaining / durationRef.current) * 100}%`, backgroundColor: remaining < 5000 ? colors.bad : colors.primary }]} /></View>
      <Text style={s.question}>{question.text}</Text>
      {question.options.map((o, i) => {
        let bg = colors.card;
        if (correctIndex !== null) { if (i === correctIndex) bg = colors.good; else if (i === picked) bg = colors.bad; }
        else if (i === picked) bg = '#0369a1';
        return (
          <TouchableOpacity key={i} style={[s.option, { backgroundColor: bg }]} onPress={() => answer(i)}>
            <Text style={ui.text}>{o}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center' },
  code: { color: colors.primary, fontSize: 46, fontWeight: '800', letterSpacing: 6, marginVertical: 6 },
  offline: { backgroundColor: colors.bad, color: '#fff', textAlign: 'center', padding: 6, borderRadius: 8, marginBottom: 8, alignSelf: 'stretch' },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', marginBottom: 10 },
  scoreBox: { alignItems: 'center', margin: 4 },
  top: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  track: { height: 8, backgroundColor: colors.card2, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  question: { color: colors.text, fontSize: 22, fontWeight: '700', marginVertical: 22 },
  option: { padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  rankRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
});
