import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { api } from '../api';
import { auth } from '../firebase';
import { Chip, ui } from '../components/UI';
import { colors } from '../theme';

export default function LeaderboardScreen() {
  const [campusOnly, setCampusOnly] = useState(false);
  const [rows, setRows] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const me = auth.currentUser?.uid;

  const load = useCallback(async () => {
    setRefreshing(true); setError(null);
    try { setRows(await api('/leaderboard' + (campusOnly ? '?campus=CST' : ''))); }
    catch (e) { setRows([]); setError(e.message); }
    setRefreshing(false);
  }, [campusOnly]);
  useEffect(() => { load(); }, [load]);

  const medals = ['🥇', '🥈', '🥉'];
  return (
    <View style={ui.screen}>
      <View style={ui.row}>
        <Chip label="Global" on={!campusOnly} onPress={() => setCampusOnly(false)} />
        <Chip label="CST Campus" on={campusOnly} onPress={() => setCampusOnly(true)} />
      </View>
      {error && <Text style={{ color: colors.bad, marginBottom: 8 }}>{error}</Text>}
      <FlatList
        data={rows}
        keyExtractor={(r) => r.uid}
        refreshing={refreshing}
        onRefresh={load}
        ListEmptyComponent={!refreshing && !error ? <Text style={ui.muted}>No players yet. Be the first!</Text> : null}
        renderItem={({ item, index }) => (
          <View style={[s.row, item.uid === me && s.me]}>
            <Text style={[ui.text, { width: 40 }]}>{medals[index] || `${index + 1}.`}</Text>
            <Text style={[ui.text, { flex: 1 }]}>{item.avatar} {item.username}</Text>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>{item.totalScore}</Text>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: colors.card, marginBottom: 8 },
  me: { borderWidth: 1, borderColor: colors.primary },
});
