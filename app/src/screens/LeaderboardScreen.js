import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, ScrollView, StyleSheet } from 'react-native';
import { api, getColleges } from '../api';
import { auth } from '../firebase';
import { Chip, useUI } from '../components/UI';
import { useTheme, useStyles } from '../ThemeContext';

export default function LeaderboardScreen() {
  const { colors } = useTheme();
  const ui = useUI();
  const s = useStyles(makeStyles);
  const [colleges, setColleges] = useState([]);
  const [selected, setSelected] = useState(null);   // null = Global, otherwise a college id
  const [rows, setRows] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const me = auth.currentUser?.uid;

  useEffect(() => { getColleges().then((r) => setColleges(r.colleges || [])).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setRefreshing(true); setError(null);
    try { setRows(await api('/leaderboard' + (selected ? `?campus=${encodeURIComponent(selected)}` : ''))); }
    catch (e) { setRows([]); setError(e.message); }
    setRefreshing(false);
  }, [selected]);
  useEffect(() => { load(); }, [load]);

  const medals = ['🥇', '🥈', '🥉'];
  return (
    <View style={ui.screen}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 8 }}>
        <Chip label="Global" on={selected === null} onPress={() => setSelected(null)} />
        {colleges.map((c) => <Chip key={c.id} label={c.id} on={selected === c.id} onPress={() => setSelected(c.id)} />)}
      </ScrollView>
      {selected && <Text style={[ui.muted, { marginBottom: 8 }]}>{colleges.find((c) => c.id === selected)?.name}</Text>}
      {error && <Text style={{ color: colors.bad, marginBottom: 8 }}>{error}</Text>}
      <FlatList
        data={rows}
        keyExtractor={(r) => r.uid}
        refreshing={refreshing}
        onRefresh={load}
        ListEmptyComponent={!refreshing && !error ? <Text style={ui.muted}>No players yet. Play a quiz to get on the board!</Text> : null}
        renderItem={({ item, index }) => (
          <View style={[s.row, item.uid === me && s.me]}>
            <Text style={[ui.text, { width: 40 }]}>{medals[index] || `${index + 1}.`}</Text>
            <View style={{ flex: 1 }}>
              <Text style={ui.text}>{item.avatar} {item.username}</Text>
              {!selected && item.campus ? <Text style={ui.muted}>{item.campus}</Text> : null}
            </View>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>{item.totalScore}</Text>
          </View>
        )}
      />
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: colors.card, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  me: { borderColor: colors.primary },
});
