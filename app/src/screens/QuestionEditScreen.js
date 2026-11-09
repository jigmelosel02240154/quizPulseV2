import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { api } from '../api';
import { Button, Card, Chip, useUI } from '../components/UI';
import { useTheme, useStyles } from '../ThemeContext';

const SUBJECTS = ['IT', 'Math', 'General Knowledge'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const MAX_OPTIONS = 6;

export default function QuestionEditScreen({ route, navigation }) {
  const q = route.params?.question; // undefined = adding a new question
  const { colors } = useTheme();
  const ui = useUI();
  const s = useStyles(makeStyles);
  const [subject, setSubject] = useState(q?.subject || 'IT');
  const [difficulty, setDifficulty] = useState(q?.difficulty || 'easy');
  const [text, setText] = useState(q?.text || '');
  const [options, setOptions] = useState(q?.options?.length ? q.options : ['', '', '', '']);
  const [correct, setCorrect] = useState(q?.correctIndex ?? 0);
  const [saving, setSaving] = useState(false);

  const setOption = (i, v) => setOptions((os) => os.map((o, k) => (k === i ? v : o)));
  const addOption = () => options.length < MAX_OPTIONS && setOptions((os) => [...os, '']);
  const removeOption = (i) => {
    if (options.length <= 2) return;
    setOptions((os) => os.filter((_, k) => k !== i));
    setCorrect((c) => (i === c ? 0 : i < c ? c - 1 : c));
  };

  const save = async () => {
    const cleaned = options.map((o) => o.trim());
    if (text.trim().length < 5) return Alert.alert('Question too short', 'Write at least 5 characters.');
    if (cleaned.some((o) => !o)) return Alert.alert('Empty option', 'Fill in every answer option or remove the empty ones.');
    if (new Set(cleaned.map((o) => o.toLowerCase())).size !== cleaned.length) return Alert.alert('Duplicate options', 'Each answer option must be different.');

    setSaving(true);
    try {
      const body = { subject, difficulty, text: text.trim(), options: cleaned, correctIndex: correct };
      await api(q ? `/admin/questions/${q.id}` : '/admin/questions', { method: q ? 'PUT' : 'POST', body });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Could not save', e.message);
    }
    setSaving(false);
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={ui.h2}>Subject</Text>
        <View style={ui.row}>{SUBJECTS.map((x) => <Chip key={x} label={x} on={subject === x} onPress={() => setSubject(x)} />)}</View>
        <Text style={[ui.h2, { marginTop: 6 }]}>Difficulty</Text>
        <View style={ui.row}>{DIFFICULTIES.map((x) => <Chip key={x} label={x} on={difficulty === x} onPress={() => setDifficulty(x)} />)}</View>
      </Card>

      <Card>
        <Text style={ui.h2}>Question</Text>
        <TextInput style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]} multiline value={text} onChangeText={setText}
          placeholder="Type the question..." placeholderTextColor={colors.muted} />
      </Card>

      <Card>
        <Text style={ui.h2}>Answer options</Text>
        <Text style={[ui.muted, { marginBottom: 10 }]}>Tap the circle next to the correct answer.</Text>
        {options.map((o, i) => (
          <View key={i} style={s.optRow}>
            <TouchableOpacity onPress={() => setCorrect(i)} style={[s.radio, correct === i && s.radioOn]}>
              {correct === i && <Text style={{ color: colors.onPrimary, fontWeight: '800' }}>✓</Text>}
            </TouchableOpacity>
            <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} value={o} onChangeText={(v) => setOption(i, v)}
              placeholder={`Option ${i + 1}`} placeholderTextColor={colors.muted} />
            {options.length > 2 && (
              <TouchableOpacity onPress={() => removeOption(i)} style={{ paddingLeft: 10 }}><Text style={{ color: colors.bad, fontSize: 18 }}>✕</Text></TouchableOpacity>
            )}
          </View>
        ))}
        {options.length < MAX_OPTIONS && <Button title="+ Add option" variant="ghost" onPress={addOption} style={{ marginBottom: 0, marginTop: 6 }} />}
      </Card>

      <Button title={saving ? 'Saving...' : q ? 'Save changes' : 'Add question'} onPress={save} disabled={saving} />
    </ScrollView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  input: { backgroundColor: colors.card2, color: colors.text, borderRadius: 12, padding: 12, fontSize: 16 },
  optRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  radio: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  radioOn: { backgroundColor: colors.primary },
});
