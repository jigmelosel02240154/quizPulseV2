import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseConfig } from './config';

const app = initializeApp(firebaseConfig);
// Persistence keeps the user signed in between app launches.
export const auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
