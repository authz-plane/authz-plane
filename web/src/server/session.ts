import { z } from "zod";

/**
 * Encrypted session cookie for the BFF (system design §10, §11.2).
 *
 * The browser only ever holds this opaque blob: AES-256-GCM over a small JSON
 * payload, HttpOnly, Secure in production, SameSite=Lax. Bearer tokens for the
 * .NET API will live inside the payload once OIDC lands and are attached by
 * route handlers server-side; nothing here is readable from browser JS.
 *
 * WebCrypto only. The proxy runs on the Node runtime today, but the module
 * stays portable to the edge runtime if that ever changes.
 */

export const SESSION_COOKIE = "azp_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export const SessionSchema = z.object({
  /** subject as the IdP names it, e.g. "user:raj" */
  sub: z.string().min(1),
  name: z.string().min(1),
  email: z.string().min(1),
  /** display role for the sidebar user row */
  role: z.string().min(1),
  /** epoch seconds */
  iat: z.number().int(),
  exp: z.number().int(),
});
export type Session = z.infer<typeof SessionSchema>;

const enc = new TextEncoder();
const dec = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const padded =
    s.replaceAll("-", "+").replaceAll("_", "/") +
    "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let cachedKey: Promise<CryptoKey> | undefined;
let warnedDevKey = false;

async function keyMaterial(): Promise<Uint8Array> {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret) {
    const raw = fromBase64Url(secret);
    if (raw.length !== 32) {
      throw new Error(
        "SESSION_SECRET must decode to exactly 32 bytes (base64url).",
      );
    }
    return raw;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production.");
  }
  if (!warnedDevKey) {
    warnedDevKey = true;
    console.warn(
      "[session] SESSION_SECRET unset; using a fixed development key. Do not deploy like this.",
    );
  }
  // Deterministic, obviously-not-secret dev key so `npm run dev` works out of the box.
  const digest = await crypto.subtle.digest(
    "SHA-256",
    enc.encode("authz-plane development session key"),
  );
  return new Uint8Array(digest);
}

function sessionKey(): Promise<CryptoKey> {
  cachedKey ??= keyMaterial().then((raw) =>
    crypto.subtle.importKey(
      "raw",
      raw as BufferSource,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    ),
  );
  return cachedKey;
}

/** For tests: forget the cached key so a changed SESSION_SECRET takes effect. */
export function resetSessionKeyForTests(): void {
  cachedKey = undefined;
  warnedDevKey = false;
}

export async function sealSession(session: Session): Promise<string> {
  const key = await sessionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = enc.encode(JSON.stringify(SessionSchema.parse(session)));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext,
  );
  return `${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`;
}

/**
 * Returns the session, or null for anything that is not a valid, unexpired
 * cookie sealed with our key. Never throws on bad input: a tampered cookie is
 * simply "not signed in".
 */
export async function openSession(
  cookieValue: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<Session | null> {
  if (!cookieValue) return null;
  const dot = cookieValue.indexOf(".");
  if (dot <= 0) return null;
  try {
    const key = await sessionKey();
    const iv = fromBase64Url(cookieValue.slice(0, dot));
    const ciphertext = fromBase64Url(cookieValue.slice(dot + 1));
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    );
    const parsed = SessionSchema.safeParse(JSON.parse(dec.decode(plaintext)));
    if (!parsed.success) return null;
    if (parsed.data.exp <= nowSeconds) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
