import type { Sponsor } from "@/types";

const STOP = /\b(egypt|eg|co|company|inc|llc|group|official|systems|technologies|the)\b/g;

// A few Arabic ↔ English aliases. Grows over time; the AI check covers the rest later.
const ALIASES: Record<string, string> = {
  اورنج: "orange",
  أورنج: "orange",
  فودافون: "vodafone",
  جهينة: "juhayna",
  بيبسي: "pepsico",
  "كوكا كولا": "cocacola",
  مايكروسوفت: "microsoft",
};

export function normalizeName(name: string) {
  let n = name.trim().toLowerCase();
  for (const [ar, en] of Object.entries(ALIASES)) n = n.replace(ar, en);
  return n.replace(STOP, "").replace(/[^a-z0-9؀-ۿ]/g, "");
}

export function domainOf(value: string) {
  const v = value.trim().toLowerCase();
  if (!v) return "";
  const at = v.split("@")[1];
  const host = (at ?? v).replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  return host.includes(".") ? host : "";
}

function similarity(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return 0.9;
  const grams = (s: string) => new Set(Array.from({ length: Math.max(s.length - 1, 1) }, (_, i) => s.slice(i, i + 2)));
  const A = grams(a);
  const B = grams(b);
  let hit = 0;
  A.forEach((g) => B.has(g) && hit++);
  return (2 * hit) / (A.size + B.size);
}

export type DuplicateHit = { sponsor: Sponsor; reason: string };

export function findDuplicate(
  input: { name: string; website: string; email: string; linkedin: string },
  pool: Sponsor[],
): DuplicateHit | null {
  const n = normalizeName(input.name);
  const d = domainOf(input.website) || domainOf(input.email);
  const li = input.linkedin.trim().toLowerCase().replace(/\/$/, "");
  for (const s of pool) {
    if (li && s.linkedin && s.linkedin.toLowerCase().replace(/\/$/, "") === li) return { sponsor: s, reason: "same LinkedIn page" };
    const sd = domainOf(s.website) || domainOf(s.email);
    if (d && sd && d === sd) return { sponsor: s, reason: "same website" };
  }
  if (n.length < 3) return null;
  let best: DuplicateHit | null = null;
  let score = 0;
  for (const s of pool) {
    const sc = similarity(n, normalizeName(s.name));
    if (sc > score) {
      score = sc;
      best = { sponsor: s, reason: sc === 1 ? "same name" : "very similar name" };
    }
  }
  return score >= 0.8 ? best : null;
}
