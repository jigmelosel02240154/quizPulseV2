import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './src/firebase';
import { colors } from './src/theme';
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

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.card, text: colors.text, primary: colors.primary, border: colors.border },
};
const header = { headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text };
const icons = { Home: 'game-controller', Analytics: 'stats-chart', Leaderboard: 'trophy', Profile: 'person' };

function Tabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      ...header,
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

export default function App() {
  const [user, setUser] = useState(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  if (user === undefined) return <Loading />;

  return (
    <NavigationContainer theme={theme}>
      <StatusBar style="light" />
      <Stack.Navigator screenOptions={header}>
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
