import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { Button, Chip, useUI } from '../components/UI';
import { useTheme, useStyles } from '../ThemeContext';

const FILTERS = ['All', 'IT', 'Math', 'General Knowledge'];

export default function AdminQuestionsScreen({ navigation }) {
  const { colors } = useTheme();
  const ui = useUI();
  const s = useStyles(makeStyles);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subject, setSubject] = useState('All');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await api('/admin/questions')); }
    catch (e) {
      setItems([]);
      setError(e.message === 'Admins only'
        ? 'This account is not an admin. Run "npm run make-admin -- <email>" on the server, then log out and back in.'
        : e.message);
    }
    setLoading(false);
  }, []);

  // reload every time we come back from the edit screen
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((x) => (subject === 'All' || x.subject === subject) && (!q || (x.text || '').toLowerCase().includes(q)))
      .sort((a, b) => (a.subject || '').localeCompare(b.subject || '') || (a.text || '').localeCompare(b.text || ''));
  }, [items, subject, search]);

  const remove = (item) => {
    Alert.alert('Delete question?', item.text, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api(`/admin/questions/${item.id}`, { method: 'DELETE' }); setItems((xs) => xs.filter((x) => x.id !== item.id)); }
        catch (e) { Alert.alert('Could not delete', e.message); }
      } },
    ]);
  };

  return (
    <View style={ui.screen}>
      <Button title="+ Add question" onPress={() => navigation.navigate('QuestionEdit')} />
      <TextInput style={s.search} placeholder="Search questions..." placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} />
      <View style={ui.row}>{FILTERS.map((f) => <Chip key={f} label={f} on={subject === f} onPress={() => setSubject(f)} />)}</View>
      <Text style={[ui.muted, { marginBottom: 8 }]}>{shown.length} of {items.length} questions</Text>
      {error && <Text style={{ color: colors.bad, marginBottom: 8 }}>{error}</Text>}

      <FlatList
        data={shown}
        keyExtractor={(x) => x.id}
        refreshing={loading}
        onRefresh={load}
        ListEmptyComponent={!loading && !error ? <Text style={ui.muted}>No questions found.</Text> : null}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.card} onPress={() => navigation.navigate('QuestionEdit', { question: item })}>
            <Text style={ui.text} numberOfLines={3}>{item.text}</Text>
            <Text style={[ui.muted, { marginTop: 4 }]}>{item.subject} · {item.difficulty}</Text>
            <Text style={{ color: colors.good, marginTop: 4 }} numberOfLines={1}>✓ {item.options?.[item.correctIndex]}</Text>
            <View style={s.actions}>
              <Text style={s.edit}>Tap to edit</Text>
              <TouchableOpacity onPress={() => remove(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={s.del}>Delete</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  search: { backgroundColor: colors.card, color: colors.text, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  edit: { color: colors.primary, fontSize: 13 },
  del: { color: colors.bad, fontWeight: '700' },
});
