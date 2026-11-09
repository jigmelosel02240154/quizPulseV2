import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './src/firebase';
import { ThemeProvider, useTheme } from './src/ThemeContext';
import { Loading } from './src/components/UI';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import RoomScreen from './src/screens/RoomScreen';
import SinglePlayerScreen from './src/screens/SinglePlayerScreen';
import StatsScreen from './src/screens/StatsScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AdminQuestionsScreen from './src/screens/AdminQuestionsScreen';
import QuestionEditScreen from './src/screens/QuestionEditScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const icons = { Home: 'game-controller', Analytics: 'stats-chart', Leaderboard: 'trophy', Profile: 'person' };

const headerOptions = (colors) => ({ headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text });

function Tabs() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      ...headerOptions(colors),
      tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.muted,
      tabBarIcon: ({ color, size }) => <Ionicons name={icons[route.name]} size={size} color={color} />,
    })}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'QuizPulse' }} />
      <Tab.Screen name="Analytics" component={StatsScreen} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function Root() {
  const { colors, scheme } = useTheme();
  const [user, setUser] = useState(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: colors.bg, card: colors.card, text: colors.text, primary: colors.primary, border: colors.border },
  };

  if (user === undefined) return <Loading />;

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack.Navigator screenOptions={headerOptions(colors)}>
        {user ? (
          <>
            <Stack.Screen name="Main" component={Tabs} options={{ headerShown: false }} />
            <Stack.Screen name="Room" component={RoomScreen} options={{ title: 'Battle Arena' }} />
            <Stack.Screen name="Practice" component={SinglePlayerScreen} options={{ title: 'Practice' }} />
            <Stack.Screen name="AdminQuestions" component={AdminQuestionsScreen} options={{ title: 'Manage questions' }} />
            <Stack.Screen name="QuestionEdit" component={QuestionEditScreen} options={{ title: 'Question' }} />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  );
}
