// Port of server/googleSheetsClient.js with WebCrypto instead of googleapis (ADR 0001, item 3).
export interface SheetsEnv {
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
  GOOGLE_SHEETS_SPREADSHEET_ID?: string;
  GOOGLE_SHEETS_FEEDBACK_RANGE?: string;
}
export interface FeedbackRow {
  timestamp: string;
  rating: unknown;
  message: string;
  context?: unknown;
  meta?: unknown;
}

export const sheetsConfigured = (env: SheetsEnv): boolean =>
  Boolean(env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY && env.GOOGLE_SHEETS_SPREADSHEET_ID);

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const tokens = new Map<string, { token: string; expiresAt: number }>();

const b64url = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));

async function signJwt(email: string, rawKey: string): Promise<string> {
  const pem = rawKey.replace(/\\n/g, "\n").replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (ch) => ch.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const input = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })}`;
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(input));
  return `${input}.${b64url(new Uint8Array(sig))}`;
}

async function accessToken(email: string, rawKey: string): Promise<string> {
  const hit = tokens.get(email);
  if (hit && Date.now() < hit.expiresAt) return hit.token;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${await signJwt(email, rawKey)}`,
  });
  if (!res.ok) throw new Error(`token ${res.status}`);
  const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number };
  tokens.set(email, { token: access_token, expiresAt: Date.now() + (expires_in - 60) * 1000 });
  return access_token;
}

export async function appendFeedbackRow(env: SheetsEnv, row: FeedbackRow): Promise<{ success: boolean }> {
  if (!sheetsConfigured(env)) return { success: false };
  try {
    const token = await accessToken(env.GOOGLE_SERVICE_ACCOUNT_EMAIL!, env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!);
    const range = env.GOOGLE_SHEETS_FEEDBACK_RANGE || "Feedback!A:E";
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEETS_SPREADSHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        values: [[row.timestamp, row.rating, row.message, row.context ? JSON.stringify(row.context) : "", row.meta ? JSON.stringify(row.meta) : ""]],
      }),
    });
    if (!res.ok) {
      console.error(`sheets append failed: ${res.status}`);
      return { success: false };
    }
    return { success: true };
  } catch (e) {
    console.error(`sheets sync failed: ${e instanceof Error ? e.message : "error"}`);
    return { success: false };
  }
}
