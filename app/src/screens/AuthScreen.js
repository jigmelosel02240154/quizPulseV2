import React, { useState } from 'react';
import { View, Text, TextInput, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { api, usernameAvailable } from '../api';
import { Button } from '../components/UI';
import { colors, AVATARS } from '../theme';

export default function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [busy, setBusy] = useState(false);

  const friendly = (e) => {
    const c = e.code || '';
    if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'Incorrect email or password.';
    if (c.includes('email-already-in-use')) return 'That email is already registered.';
    if (c.includes('weak-password')) return 'Password must be at least 6 characters.';
    if (c.includes('invalid-email')) return 'Enter a valid email address.';
    if (c.includes('network')) return 'Network error. Check your connection.';
    return e.message || 'Something went wrong.';
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (mode === 'register') {
        const check = await usernameAvailable(username.trim());
        if (!check.available) throw new Error(check.reason || 'That username is taken.');
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        try {
          await api('/profile', { method: 'POST', body: { username: username.trim(), campus: 'CST', avatar } });
        } catch (e) {
          await cred.user.delete(); // don't leave an account without a profile
          throw e;
        }
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
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
        <Text style={s.tag}>Real-time quiz battles for CST students</Text>

        {mode === 'register' && (
          <>
            <View style={s.avatars}>
              {AVATARS.map((a) => (
                <TouchableOpacity key={a} onPress={() => setAvatar(a)} style={[s.avatar, avatar === a && s.avatarOn]}>
                  <Text style={{ fontSize: 26 }}>{a}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={s.input} placeholder="Username (3-20 letters/numbers)" placeholderTextColor={colors.muted} value={username} onChangeText={setUsername} autoCapitalize="none" />
          </>
        )}
        <TextInput style={s.input} placeholder="Email" placeholderTextColor={colors.muted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextInput style={s.input} placeholder="Password" placeholderTextColor={colors.muted} value={password} onChangeText={setPassword} secureTextEntry />

        <Button title={busy ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'} onPress={submit} disabled={busy} />
        {mode === 'login' && <TouchableOpacity onPress={reset}><Text style={s.link}>Forgot password?</Text></TouchableOpacity>}
        <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
          <Text style={s.link}>{mode === 'login' ? 'New here? Create an account' : 'Already have an account? Log in'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 38, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  tag: { color: colors.muted, textAlign: 'center', marginBottom: 28, marginTop: 4 },
  input: { backgroundColor: colors.card, color: colors.text, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  link: { color: colors.muted, textAlign: 'center', marginTop: 12 },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 14 },
  avatar: { padding: 8, margin: 4, borderRadius: 14, borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.card },
  avatarOn: { borderColor: colors.primary },
});
