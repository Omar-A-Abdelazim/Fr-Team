"use client";

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import { ADMIN_EMAILS, auth, db } from "./client";
import type { Member } from "@/types";

const PALETTE = ["#4cc3f2", "#f5b83d", "#3dd6a3", "#f47c6b", "#a78bfa", "#fb923c", "#38bdf8", "#facc15"];

type AuthState = {
  user: User | null;
  profile: Member | null;
  loading: boolean;
  /** "signin" refuses people without an account; "signup" creates one (pending approval). */
  signInGoogle: (mode: "signin" | "signup") => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

class AuthFlowError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/** Listed admins skip approval, but only once Google (or their inbox) has proven they own the email. */
function isListedAdmin(u: User) {
  return ADMIN_EMAILS.includes((u.email ?? "").toLowerCase()) && u.emailVerified;
}

async function createProfile(u: User, name?: string) {
  const email = (u.email ?? "").toLowerCase();
  const admin = isListedAdmin(u);
  await setDoc(doc(db, "users", u.uid), {
    name: name || u.displayName || email.split("@")[0],
    email,
    photoURL: u.photoURL ?? null,
    role: admin ? "admin" : "member",
    approved: admin,
    color: PALETTE[[...u.uid].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length],
    createdAt: serverTimestamp(),
  });
}

async function hasProfile(u: User) {
  return (await getDoc(doc(db, "users", u.uid))).exists();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;
    const unsub = onAuthStateChanged(auth, (u) => {
      unsubProfile?.();
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
        return;
      }
      unsubProfile = onSnapshot(
        doc(db, "users", u.uid),
        (snap) => {
          const d = snap.data();
          const p = d ? ({ id: snap.id, ...d } as Member) : null;
          // A listed admin who signed up before verifying their email gets upgraded once verified.
          if (p && isListedAdmin(u) && (p.role !== "admin" || p.approved === false)) {
            updateDoc(snap.ref, { role: "admin", approved: true }).catch(() => undefined);
          }
          setProfile(p);
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
    async signInGoogle(mode) {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      if (await hasProfile(cred.user)) return;
      if (mode === "signin" && !isListedAdmin(cred.user)) {
        await fbSignOut(auth);
        throw new AuthFlowError("app/no-account");
      }
      await createProfile(cred.user);
    },
    async signInEmail(email, password) {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (await hasProfile(cred.user)) return;
      await fbSignOut(auth);
      throw new AuthFlowError("app/no-account");
    },
    async signUpEmail(name, email, password) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      sendEmailVerification(cred.user).catch(() => undefined);
      await createProfile(cred.user, name);
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
  "app/no-account": "You don't have an account yet. Use Join the team to request access.",
  "auth/invalid-credential": "Email or password is wrong. Check them and try again.",
  "auth/wrong-password": "Email or password is wrong. Check them and try again.",
  "auth/user-not-found": "No account with this email yet. Use Join the team to request access.",
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
