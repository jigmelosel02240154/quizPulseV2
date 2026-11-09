import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../ThemeContext';

const makeUI = (c) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg, padding: 16 },
  card: { backgroundColor: c.card, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: c.border },
  btn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  btnText: { fontWeight: '700', fontSize: 16 },
  chip: { borderWidth: 1, borderColor: c.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8, marginBottom: 8 },
  h1: { color: c.text, fontSize: 22, fontWeight: '800' },
  h2: { color: c.primary, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  text: { color: c.text, fontSize: 16 },
  muted: { color: c.muted, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});

// Shared styles that follow the current theme: const ui = useUI();
export function useUI() {
  const { colors } = useTheme();
  return useMemo(() => makeUI(colors), [colors]);
}

export const Screen = ({ children, style }) => {
  const ui = useUI();
  return <View style={[ui.screen, style]}>{children}</View>;
};

export const Card = ({ children, style }) => {
  const ui = useUI();
  return <View style={[ui.card, style]}>{children}</View>;
};

export const Loading = () => {
  const ui = useUI();
  const { colors } = useTheme();
  return (
    <View style={[ui.screen, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
};

export function Button({ title, onPress, variant = 'primary', disabled, style }) {
  const ui = useUI();
  const { colors } = useTheme();
  const bg = variant === 'primary' ? colors.primary : variant === 'accent' ? colors.accent : colors.card2;
  const fg = variant === 'ghost' ? colors.text : colors.onPrimary;
  return (
    <TouchableOpacity activeOpacity={0.8} disabled={disabled} onPress={onPress}
      style={[ui.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }, style]}>
      <Text style={[ui.btnText, { color: fg }]}>{title}</Text>
    </TouchableOpacity>
  );
}

export const Chip = ({ label, on, onPress }) => {
  const ui = useUI();
  const { colors } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} style={[ui.chip, on && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
      <Text style={{ color: on ? colors.onPrimary : colors.primary, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );
};
