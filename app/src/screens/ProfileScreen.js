import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { api } from '../api';
import { closeSocket } from '../socket';
import { Button, Card, ui } from '../components/UI';
import { colors, AVATARS, BADGES } from '../theme';

export default function ProfileScreen() {
  const [me, setMe] = useState({});
  useFocusEffect(useCallback(() => { api('/me').then(setMe).catch(() => {}); }, []));

  const pick = async (avatar) => {
    setMe((m) => ({ ...m, avatar }));
    try { await api('/profile', { method: 'PATCH', body: { avatar } }); } catch {}
  };
  const logout = () => { closeSocket(); signOut(auth); };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Card style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 56 }}>{me.avatar || '🦊'}</Text>
        <Text style={ui.h1}>{me.username}</Text>
        <Text style={ui.muted}>{auth.currentUser?.email}</Text>
        <Text style={[ui.muted, { marginTop: 2 }]}>{me.campus || 'CST'} campus</Text>
      </Card>

      <Card>
        <Text style={ui.h2}>Choose avatar</Text>
        <View style={s.avatars}>
          {AVATARS.map((a) => (
            <TouchableOpacity key={a} onPress={() => pick(a)} style={[s.avatar, me.avatar === a && { borderColor: colors.primary }]}>
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
  avatars: { flexDirection: 'row', flexWrap: 'wrap' },
  avatar: { padding: 8, margin: 4, borderRadius: 14, borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.card2 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
});
