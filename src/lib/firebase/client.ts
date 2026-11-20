import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// The web config is public by design (security comes from Firestore rules), so the
// project's values are used as defaults and env vars can override them per deploy.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyBuSIg7u4MSItU4H7c3EksLPeTdt_kN66w",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "ieee-met-fr-hub.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "ieee-met-fr-hub",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "ieee-met-fr-hub.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "56590142860",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:56590142860:web:9f5a55304a6eaef9be1aa9",
};

export const app = getApps().length ? getApp() : initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Must match the list in firestore.rules.
export const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "omarahmedabdelazim2005@gmail.com,shahdelhosiny21@gmail.com,saraata002@gmail.com,nadaalsaied21@gmail.com,knada6325@gmail.com,yassintube126@gmail.com,basmala.a.attia@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
