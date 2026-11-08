import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { signOut, sendEmailVerification } from 'firebase/auth';
import { auth } from '../firebase';
import { api } from '../api';
import { closeSocket } from '../socket';
import { Button, Card, ui } from '../components/UI';
import { colors, AVATARS, BADGES } from '../theme';

export default function ProfileScreen({ navigation }) {
  const [me, setMe] = useState({});
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState('');
  const [campusOpen, setCampusOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(!!auth.currentUser?.emailVerified);

  const load = useCallback(async () => {
    try { setMe(await api('/me')); } catch {}
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    setEditingName(false);
    setCampusOpen(false);
  }, [load]));

  const loaded = !!me.uid;
  const needsName = loaded && !me.username;          // profile was never completed
  const eligible = me.eligibleColleges || [];
  const hints = (me.colleges || []).map((c) => `${c.id}: ${c.emailHint}`).join(', ');
  const needsVerify = me.requireVerifiedEmail && !verified;

  // ----- avatar -----
  const pickAvatar = async (avatar) => {
    setMe((m) => ({ ...m, avatar }));
    try { await api('/profile', { method: 'PATCH', body: { avatar } }); } catch {}
  };

  // ----- username (hidden behind a button, with a confirmation) -----
  const doSaveName = async () => {
    setBusy(true);
    try {
      await api('/profile', { method: 'PATCH', body: { username: name.trim() } });
      await load();
      setEditingName(false);
    } catch (e) { Alert.alert('Could not save', e.message); }
    setBusy(false);
  };
  const saveName = () => {
    const n = name.trim();
    if (needsName) return doSaveName();
    if (n === me.username) return setEditingName(false);
    Alert.alert('Change username?', `Your name will change from "${me.username}" to "${n}".`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Change', onPress: doSaveName },
    ]);
  };

  // ----- campus -----
  const chooseCampus = (id) => {
    if (id === (me.campus || null)) return setCampusOpen(false);
    Alert.alert(
      'Change campus?',
      id ? `Switch your campus to ${id}?` : 'Leave your campus? You will no longer appear on a campus leaderboard.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: async () => {
          setBusy(true);
          try {
            if (me.requireVerifiedEmail) { await auth.currentUser.reload(); await auth.currentUser.getIdToken(true); }
            await api('/profile', { method: 'PATCH', body: { campus: id } });
            await load();
            setCampusOpen(false);
          } catch (e) { Alert.alert('Could not change campus', e.message); }
          setBusy(false);
        } },
      ]);
  };

  const sendVerification = async () => {
    try { await sendEmailVerification(auth.currentUser); Alert.alert('Email sent', 'Open the link in your inbox, then tap "I have verified".'); }
    catch (e) { Alert.alert('Could not send', e.message); }
  };
  const checkVerified = async () => {
    try {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      setVerified(!!auth.currentUser.emailVerified);
      Alert.alert(auth.currentUser.emailVerified ? 'Verified' : 'Not verified yet', auth.currentUser.emailVerified ? 'You can now choose your campus.' : 'Open the link in the email first.');
    } catch (e) { Alert.alert('Error', e.message); }
  };

  const logout = () => { closeSocket(); signOut(auth); };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Card style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 56 }}>{me.avatar || '🦊'}</Text>
        <Text style={ui.h1}>{me.username || 'New player'}</Text>
        <Text style={ui.muted}>{auth.currentUser?.email}</Text>
        <Text style={[ui.muted, { marginTop: 2 }]}>{me.campusName || 'No campus'}</Text>
      </Card>

      {/* Username */}
      <Card>
        <Text style={ui.h2}>Username</Text>
        {needsName && <Text style={[ui.muted, { marginBottom: 8 }]}>Choose a username to finish setting up your profile.</Text>}
        {editingName || needsName ? (
          <>
            <TextInput style={s.input} value={name} onChangeText={setName} placeholder="3-20 letters, numbers or _" placeholderTextColor={colors.muted} autoCapitalize="none" maxLength={20} />
            <Button title={busy ? 'Saving...' : 'Save'} onPress={saveName} disabled={busy || name.trim().length < 3} style={{ marginBottom: 8 }} />
            {!needsName && <Button title="Cancel" variant="ghost" onPress={() => setEditingName(false)} style={{ marginBottom: 0 }} />}
          </>
        ) : (
          <View style={s.line}>
            <Text style={ui.text}>{me.username}</Text>
            <TouchableOpacity onPress={() => { setName(me.username || ''); setEditingName(true); }}>
              <Text style={s.action}>Change</Text>
            </TouchableOpacity>
          </View>
        )}
      </Card>

      {/* Campus */}
      <Card>
        <Text style={ui.h2}>Campus</Text>
        <View style={s.line}>
          <Text style={ui.text}>{me.campusName || 'Not part of a campus'}</Text>
          {(eligible.length > 0 || me.campus) && (
            <TouchableOpacity onPress={() => setCampusOpen(!campusOpen)}><Text style={s.action}>{campusOpen ? 'Close' : 'Change'}</Text></TouchableOpacity>
          )}
        </View>

        {eligible.length === 0 && (
          <Text style={[ui.muted, { marginTop: 8 }]}>
            Joining a campus needs your college email. Your email ({me.email}) doesn't match a college. College emails end with: {hints || '(none configured)'}.
          </Text>
        )}

        {needsVerify && eligible.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <Text style={ui.muted}>Verify your email to join a campus.</Text>
            <Button title="Send verification email" variant="ghost" onPress={sendVerification} style={{ marginTop: 8, marginBottom: 6 }} />
            <Button title="I have verified" variant="ghost" onPress={checkVerified} style={{ marginBottom: 0 }} />
          </View>
        )}

        {campusOpen && (
          <View style={{ marginTop: 12 }}>
            {eligible.map((c) => (
              <TouchableOpacity key={c.id} disabled={busy} style={[s.option, me.campus === c.id && s.optionOn]} onPress={() => chooseCampus(c.id)}>
                <Text style={ui.text}>{c.id}: {c.name}{me.campus === c.id ? '  ✓' : ''}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity disabled={busy} style={[s.option, !me.campus && s.optionOn]} onPress={() => chooseCampus(null)}>
              <Text style={ui.text}>No campus{!me.campus ? '  ✓' : ''}</Text>
            </TouchableOpacity>
          </View>
        )}
      </Card>

      {me.isAdmin && (
        <Card>
          <Text style={ui.h2}>Admin</Text>
          <Button title="Manage questions" onPress={() => navigation.navigate('AdminQuestions')} style={{ marginBottom: 0 }} />
        </Card>
      )}

      <Card>
        <Text style={ui.h2}>Choose avatar</Text>
        <View style={s.avatars}>
          {AVATARS.map((a) => (
            <TouchableOpacity key={a} onPress={() => pickAvatar(a)} style={[s.avatar, me.avatar === a && { borderColor: colors.primary }]}>
              <Text style={{ fontSize: 26 }}>{a}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={ui.h2}>Badges</Text>
        {Object.entries(BADGES).map(([id, b]) => {
          const earned = (me.badges || []).includes(id);
          return (
            <View key={id} style={[s.badge, { opacity: earned ? 1 : 0.4 }]}>
              <Text style={{ fontSize: 26, marginRight: 12 }}>{earned ? b.icon : '🔒'}</Text>
              <View style={{ flex: 1 }}><Text style={ui.text}>{b.label}</Text><Text style={ui.muted}>{b.desc}</Text></View>
            </View>
          );
        })}
      </Card>

      <Button title="Log out" variant="ghost" onPress={logout} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  input: { backgroundColor: colors.card2, color: colors.text, borderRadius: 12, padding: 14, marginBottom: 12, fontSize: 16 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  action: { color: colors.primary, fontWeight: '700' },
  option: { padding: 14, borderRadius: 12, backgroundColor: colors.card2, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  optionOn: { borderColor: colors.primary },
  avatars: { flexDirection: 'row', flexWrap: 'wrap' },
  avatar: { padding: 8, margin: 4, borderRadius: 14, borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.card2 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
});
