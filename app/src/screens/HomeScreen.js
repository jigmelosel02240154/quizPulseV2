import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, ScrollView, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { Button, Card, Chip, useUI } from '../components/UI';
import { useTheme, useStyles } from '../ThemeContext';
import { SUBJECTS, DIFFICULTIES } from '../theme';

const COUNTS = [5, 10, 15];

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const ui = useUI();
  const s = useStyles(makeStyles);
  const [subject, setSubject] = useState('Mixed');
  const [difficulty, setDifficulty] = useState('any');
  const [count, setCount] = useState(5);
  const [code, setCode] = useState('');
  const [me, setMe] = useState({});

  useFocusEffect(useCallback(() => { api('/me').then(setMe).catch(() => {}); }, []));

  const join = () => {
    if (!/^\d{6}$/.test(code)) return Alert.alert('Enter the 6-digit room code');
    navigation.navigate('Room', { mode: 'join', code });
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Card style={s.hero}>
        <Text style={{ fontSize: 40 }}>{me.avatar || '🦊'}</Text>
        <View style={{ marginLeft: 14 }}>
          <Text style={ui.h1}>Hi {me.username || 'player'}!</Text>
          <Text style={ui.muted}>🔥 {me.streak || 0}-day streak   ·   ⭐ {me.totalScore || 0} pts</Text>
        </View>
      </Card>

      <Card>
        <Text style={ui.h2}>Subject</Text>
        <View style={ui.row}>{SUBJECTS.map((x) => <Chip key={x} label={x} on={subject === x} onPress={() => setSubject(x)} />)}</View>
        <Text style={[ui.h2, { marginTop: 6 }]}>Difficulty</Text>
        <View style={ui.row}>{DIFFICULTIES.map((x) => <Chip key={x} label={x === 'any' ? 'Any' : x} on={difficulty === x} onPress={() => setDifficulty(x)} />)}</View>
      </Card>

      <Button title="⚔️  Quick 1v1 Match" onPress={() => navigation.navigate('Room', { mode: 'quick', subject, difficulty })} />
      <Button title="📚  Practice (solo)" variant="ghost" onPress={() => navigation.navigate('Practice', { subject, difficulty })} />

      <Card style={{ marginTop: 8 }}>
        <Text style={ui.h2}>Private room</Text>
        <Text style={[ui.muted, { marginBottom: 8 }]}>Questions per match</Text>
        <View style={ui.row}>{COUNTS.map((n) => <Chip key={n} label={String(n)} on={count === n} onPress={() => setCount(n)} />)}</View>
        <Button title="🏠  Create room" variant="accent" onPress={() => navigation.navigate('Room', { mode: 'create', subject, difficulty, questionCount: count })} />
        <View style={s.joinRow}>
          <TextInput style={s.input} placeholder="6-digit code" placeholderTextColor={colors.muted} keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} />
          <Button title="Join" onPress={join} style={{ marginBottom: 0, marginLeft: 10 }} />
        </View>
      </Card>
    </ScrollView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center' },
  joinRow: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, backgroundColor: colors.card2, color: colors.text, borderRadius: 12, padding: 14, fontSize: 18, letterSpacing: 3 },
});
