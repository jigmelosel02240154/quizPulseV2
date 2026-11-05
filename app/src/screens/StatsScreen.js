import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { Card, ui } from '../components/UI';
import { colors } from '../theme';

const barColor = (pct) => (pct >= 75 ? colors.good : pct >= 50 ? colors.accent : colors.bad);

export default function StatsScreen() {
  const [me, setMe] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { setRefreshing(true); try { setMe(await api('/me')); } catch {} setRefreshing(false); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const subjects = Object.entries(me?.subjects || {});
  const accuracy = me?.totalAnswered ? Math.round((me.totalCorrect / me.totalAnswered) * 100) : 0;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}>
      <View style={s.grid}>
        <Stat label="Daily streak" value={`🔥 ${me?.streak || 0}`} />
        <Stat label="Best streak" value={me?.bestStreak || 0} />
        <Stat label="Total points" value={me?.totalScore || 0} />
        <Stat label="Accuracy" value={`${accuracy}%`} />
        <Stat label="Matches" value={me?.matches || 0} />
        <Stat label="Wins" value={me?.wins || 0} />
      </View>

      <Card>
        <Text style={ui.h2}>Subject mastery</Text>
        {subjects.length === 0 && <Text style={ui.muted}>Play a quiz to see your accuracy by subject.</Text>}
        {subjects.map(([name, v]) => {
          const pct = v.total ? Math.round((v.correct / v.total) * 100) : 0;
          return (
            <View key={name} style={{ marginBottom: 16 }}>
              <View style={s.labelRow}><Text style={ui.text}>{name}</Text><Text style={ui.muted}>{pct}%  ({v.correct}/{v.total})</Text></View>
              <View style={s.track}><View style={[s.fill, { width: `${pct}%`, backgroundColor: barColor(pct) }]} /></View>
            </View>
          );
        })}
      </Card>
    </ScrollView>
  );
}

const Stat = ({ label, value }) => (
  <View style={s.stat}><Text style={s.statValue}>{value}</Text><Text style={ui.muted}>{label}</Text></View>
);

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  stat: { width: '31%', backgroundColor: colors.card, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 2 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  track: { height: 14, backgroundColor: colors.card2, borderRadius: 7, overflow: 'hidden' },
  fill: { height: 14, borderRadius: 7 },
});
