import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors } from './theme';

const KEY = 'quizpulse_theme_mode';
const ThemeContext = createContext(null);

// mode: 'system' (follow the phone) | 'light' | 'dark'
export function ThemeProvider({ children }) {
  const system = useColorScheme(); // 'light' | 'dark' | null
  const [mode, setModeState] = useState('system');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => { if (v === 'light' || v === 'dark' || v === 'system') setModeState(v); })
      .catch(() => {});
  }, []);

  const setMode = useCallback((m) => {
    setModeState(m);
    AsyncStorage.setItem(KEY, m).catch(() => {});
  }, []);

  const scheme = mode === 'system' ? (system === 'light' ? 'light' : 'dark') : mode;

  const value = useMemo(
    () => ({ mode, setMode, scheme, colors: scheme === 'light' ? lightColors : darkColors }),
    [mode, setMode, scheme]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

// Builds a screen's StyleSheet from the current colours: useStyles(makeStyles)
export function useStyles(make) {
  const { colors } = useTheme();
  return useMemo(() => make(colors), [colors, make]);
}
