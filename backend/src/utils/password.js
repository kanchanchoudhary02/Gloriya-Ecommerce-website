
import crypto from "node:crypto";

export function createWerkzeugScryptHash(password) {
  const N = 32768, r = 8, p = 1, keyLen = 64;
  const salt = crypto.randomBytes(8).toString("base64url");
  const derived = crypto.scryptSync(password, salt, keyLen, { N, r, p, maxmem: 128 * N * r + 1024 * 1024 });
  return `scrypt:${N}:${r}:${p}$${salt}$${derived.toString("hex")}`;
}

export function verifyWerkzeugPassword(stored, password) {
  if (!stored) return false;
  if (!stored.includes("$")) return stored === password;
  const [method, salt, expectedHex] = stored.split("$");
  if (!method || !salt || !expectedHex) return false;

  const [algorithm, nRaw, rRaw, pRaw] = method.split(":");
  if (algorithm !== "scrypt") return false;

  try {
    const N = Number(nRaw), r = Number(rRaw), p = Number(pRaw);
    const expected = Buffer.from(expectedHex, "hex");
    const actual = crypto.scryptSync(password, salt, expected.length, {
      N, r, p, maxmem: 128 * N * r + 1024 * 1024
    });
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
