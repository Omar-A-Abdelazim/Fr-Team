// Server-side identity checks without firebase-admin: the ID token is verified by Google's
// Identity Toolkit, and Firestore REST calls run with the caller's own token, so security rules apply.

export const FB_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyBuSIg7u4MSItU4H7c3EksLPeTdt_kN66w";
export const FB_PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "ieee-met-fr-hub";
export const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents`;

export type Caller = { uid: string; token: string; name: string; email: string; role: "member" | "admin" };
type Fail = { error: string; status: number };

export const json = (body: unknown, status = 200) => Response.json(body, { status });

export function bearer(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

export async function getCaller(req: Request, opts: { admin?: boolean } = {}): Promise<Caller | Fail> {
  const token = bearer(req);
  if (!token) return { error: "Sign in again to continue.", status: 401 };

  const look = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FB_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token }),
  });
  if (!look.ok) return { error: "Your session expired. Sign in again.", status: 401 };
  const uid = ((await look.json()) as { users?: { localId?: string }[] }).users?.[0]?.localId;
  if (!uid) return { error: "Your session expired. Sign in again.", status: 401 };

  const doc = await fetch(`${FIRESTORE}/users/${uid}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!doc.ok) return { error: `Couldn't load your profile (${doc.status}).`, status: 500 };
  const f = ((await doc.json()) as { fields?: Record<string, { stringValue?: string }> }).fields ?? {};
  const role = f.role?.stringValue === "admin" ? "admin" : "member";
  if (opts.admin && role !== "admin") return { error: "Admins only.", status: 403 };
  return { uid, token, role, name: f.name?.stringValue ?? "", email: f.email?.stringValue ?? "" };
}

export function isFail(x: Caller | Fail): x is Fail {
  return "error" in x;
}
