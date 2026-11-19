import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function strip(v: string) {
  return v.trim().replace(/^["']|["']$/g, "");
}

function init(): App | null {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!projectId || !clientEmail || !rawKey) return null;
  const existing = getApps()[0];
  if (existing) return existing;
  return initializeApp({
    credential: cert({
      projectId: strip(projectId),
      clientEmail: strip(clientEmail),
      privateKey: strip(rawKey).replace(/\\n/g, "\n"),
    }),
  });
}

const app = init();

/** Both are null when the FIREBASE_ADMIN_* env vars are missing. */
export const adminAuth: Auth | null = app ? getAuth(app) : null;
export const adminDb: Firestore | null = app ? getFirestore(app) : null;
