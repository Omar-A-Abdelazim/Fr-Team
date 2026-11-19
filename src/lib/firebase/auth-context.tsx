"use client";

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import { ADMIN_EMAILS, auth, db } from "./client";
import type { Member } from "@/types";

const PALETTE = ["#4cc3f2", "#f5b83d", "#3dd6a3", "#f47c6b", "#a78bfa", "#fb923c", "#38bdf8", "#facc15"];

type AuthState = {
  user: User | null;
  profile: Member | null;
  loading: boolean;
  signInGoogle: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

async function ensureProfile(u: User, nameOverride?: string) {
  const ref = doc(db, "users", u.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  const email = (u.email ?? "").toLowerCase();
  await setDoc(ref, {
    name: nameOverride || u.displayName || email.split("@")[0],
    email,
    photoURL: u.photoURL ?? null,
    role: ADMIN_EMAILS.includes(email) && u.emailVerified ? "admin" : "member",
    color: PALETTE[Math.abs([...u.uid].reduce((a, c) => a + c.charCodeAt(0), 0)) % PALETTE.length],
    createdAt: serverTimestamp(),
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;
    const unsub = onAuthStateChanged(auth, async (u) => {
      unsubProfile?.();
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        await ensureProfile(u);
      } catch {
        // rules may reject if something is off; the snapshot below surfaces the state
      }
      unsubProfile = onSnapshot(
        doc(db, "users", u.uid),
        (snap) => {
          const d = snap.data();
          setProfile(d ? ({ id: snap.id, ...d } as Member) : null);
          setLoading(false);
        },
        () => setLoading(false),
      );
    });
    return () => {
      unsub();
      unsubProfile?.();
    };
  }, []);

  const value: AuthState = {
    user,
    profile,
    loading,
    async signInGoogle() {
      await signInWithPopup(auth, new GoogleAuthProvider());
    },
    async signInEmail(email, password) {
      await signInWithEmailAndPassword(auth, email, password);
    },
    async signUpEmail(name, email, password) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await ensureProfile(cred.user, name);
    },
    async signOut() {
      await fbSignOut(auth);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}

const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Email or password is wrong. Check them and try again.",
  "auth/wrong-password": "Email or password is wrong. Check them and try again.",
  "auth/user-not-found": "No account with this email yet. Use Join the team to create one.",
  "auth/email-already-in-use": "This email already has an account. Sign in instead.",
  "auth/weak-password": "Use a password with at least 6 characters.",
  "auth/invalid-email": "That email doesn't look right.",
  "auth/popup-closed-by-user": "The Google window was closed before signing in.",
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups for this site and try again.",
  "auth/network-request-failed": "Can't reach the server. Check your connection and try again.",
  "auth/too-many-requests": "Too many attempts. Wait a minute and try again.",
  "auth/unauthorized-domain": "This site's address isn't allowed in Firebase yet. Add it under Authentication → Settings → Authorized domains.",
  "auth/operation-not-allowed": "This sign-in method is turned off in Firebase. Turn it on under Authentication → Sign-in method.",
};

export function authErrorMessage(e: unknown) {
  const code = (e as { code?: string })?.code ?? "";
  return MESSAGES[code] ?? "Something went wrong while signing in. Try again.";
}
