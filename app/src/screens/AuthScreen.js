import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';
import { auth } from '../firebase';
import { api, getColleges, signupCheck } from '../api';
import { Button, Chip } from '../components/UI';
import { useTheme, useStyles } from '../ThemeContext';
import { AVATARS } from '../theme';

export default function AuthScreen() {
  const { colors } = useTheme();
  const s = useStyles(makeStyles);
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [campus, setCampus] = useState('');          // '' = no campus
  const [colleges, setColleges] = useState([]);
  const [requireVerified, setRequireVerified] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getColleges()
      .then((r) => { setColleges(r.colleges || []); setRequireVerified(!!r.requireVerifiedEmail); })
      .catch(() => {});
  }, []);

  const selected = colleges.find((c) => c.id === campus);

  const friendly = (e) => {
    const c = e.code || '';
    if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'Incorrect email or password.';
    if (c.includes('email-already-in-use')) return 'That email is already registered.';
    if (c.includes('weak-password')) return 'Password must be at least 6 characters.';
    if (c.includes('invalid-email')) return 'Enter a valid email address.';
    if (c.includes('too-many-requests')) return 'Too many attempts. Wait a few minutes and try again.';
    if (c.includes('network')) return 'Network error. Check your connection.';
    return `${e.message || 'Something went wrong.'}${c ? ` (${c})` : ''}`;
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (mode === 'register') {
        const name = username.trim();
        const mail = email.trim();
        // Check username + college email BEFORE creating the account
        const check = await signupCheck({ username: name, email: mail, campus: campus || null });
        if (!check.ok) throw new Error(check.error);

        const cred = await createUserWithEmailAndPassword(auth, mail, password);
        try {
          await api('/profile', { method: 'POST', body: { username: name, campus: campus || null, avatar } });
        } catch (e) {
          await cred.user.delete(); // don't leave an account without a profile
          throw e;
        }
        if (requireVerified) {
          try { await sendEmailVerification(cred.user); } catch {}
          if (campus) Alert.alert('Verify your email', 'We sent you a verification link. After verifying, open Profile and choose your campus.');
        }
      } else {
        await Promise.race([
          signInWithEmailAndPassword(auth, email.trim(), password),
          new Promise((_, reject) => setTimeout(() => reject(Object.assign(
            new Error('Login timed out. Check your internet connection.'), { code: 'timeout' })), 15000)),
        ]);
      }
    } catch (e) {
      Alert.alert(mode === 'login' ? 'Login failed' : 'Registration failed', friendly(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!email.trim()) return Alert.alert('Enter your email first');
    try { await sendPasswordResetEmail(auth, email.trim()); Alert.alert('Check your inbox', 'Password reset email sent.'); }
    catch (e) { Alert.alert('Error', friendly(e)); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.logo}>⚡ QuizPulse</Text>
        <Text style={s.tag}>Real-time quiz battles for college students</Text>

        {mode === 'register' && (
          <>
            <View style={s.avatars}>
              {AVATARS.map((a) => (
                <TouchableOpacity key={a} onPress={() => setAvatar(a)} style={[s.avatar, avatar === a && s.avatarOn]}>
                  <Text style={{ fontSize: 26 }}>{a}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={s.input} placeholder="Username (3-20 letters/numbers)" placeholderTextColor={colors.muted} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />

            <Text style={s.label}>Campus (optional)</Text>
            <View style={s.chips}>
              <Chip label="None" on={campus === ''} onPress={() => setCampus('')} />
              {colleges.map((c) => <Chip key={c.id} label={c.id} on={campus === c.id} onPress={() => setCampus(c.id)} />)}
            </View>
            <Text style={s.hint}>
              {selected
                ? `${selected.name}: register with your college email, ending ${selected.emailHint}`
                : 'You can join a campus later from your Profile using your college email.'}
            </Text>
          </>
        )}
        <TextInput style={s.input} placeholder="Email" placeholderTextColor={colors.muted} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
        <TextInput style={s.input} placeholder="Password" placeholderTextColor={colors.muted} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} />

        <Button title={busy ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'} onPress={submit} disabled={busy} />
        {mode === 'login' && <TouchableOpacity onPress={reset}><Text style={s.link}>Forgot password?</Text></TouchableOpacity>}
        <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
          <Text style={s.link}>{mode === 'login' ? 'New here? Create an account' : 'Already have an account? Log in'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 38, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  tag: { color: colors.muted, textAlign: 'center', marginBottom: 28, marginTop: 4 },
  input: { backgroundColor: colors.card, color: colors.text, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  label: { color: colors.muted, marginBottom: 8, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  hint: { color: colors.muted, fontSize: 13, marginBottom: 14 },
  link: { color: colors.muted, textAlign: 'center', marginTop: 12 },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 14 },
  avatar: { padding: 8, margin: 4, borderRadius: 14, borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.card },
  avatarOn: { borderColor: colors.primary },
});
