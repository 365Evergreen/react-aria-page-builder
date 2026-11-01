const encoder = new TextEncoder();
const COOKIE = "session";
const MAX_AGE = 60 * 60 * 24 * 7;

const toHex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

const fromHex = (hex: string) =>
  new Uint8Array(hex.match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? []);

const key = (secret: string, usage: ("sign" | "verify")[]) =>
  crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usage);

async function sha256(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

export async function passwordMatches(input: string, expected: string) {
  const [a, b] = await Promise.all([sha256(input), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function createSessionCookie(secret: string, secure: boolean) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const sig = toHex(await crypto.subtle.sign("HMAC", await key(secret, ["sign"]), encoder.encode(String(exp))));
  return `${COOKIE}=${exp}.${sig}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE}${secure ? "; Secure" : ""}`;
}

export const clearSessionCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;

export async function isAuthenticated(cookieHeader: string | null | undefined, secret: string) {
  const raw = cookieHeader
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!raw) return false;
  const [exp, sig] = raw.split(".");
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  return crypto.subtle.verify("HMAC", await key(secret, ["verify"]), fromHex(sig), encoder.encode(exp));
}
