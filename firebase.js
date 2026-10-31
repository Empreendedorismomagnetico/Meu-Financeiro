
import { initializeApp, getApp, getApps } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyD3SIqrHtRNuxELEP5ezDDZyC48gi5hE2A",
  authDomain: "meu-financeiro-d6592.firebaseapp.com",
  projectId: "meu-financeiro-d6592",
  storageBucket: "meu-financeiro-d6592.firebasestorage.app",
  messagingSenderId: "553751346640",
  appId: "1:553751346640:web:a41f972788d3e64212cdd5",
  measurementId: "G-6S6XYQ91RX"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth;

try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (error) {
  auth = getAuth(app);
}

const db = getFirestore(app);

export { app, auth, db };
