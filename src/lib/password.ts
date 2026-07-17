import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const SALT_BYTES = 16;
const KEY_LENGTH = 64;

export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_BYTES);
  const hash = scryptSync(plain, salt, KEY_LENGTH);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false; // malformed ADMIN_PASSWORD_HASH — misconfiguration, not attacker input

  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== KEY_LENGTH) return false; // guards timingSafeEqual's length-mismatch throw

  const actual = scryptSync(plain, Buffer.from(saltHex, "hex"), KEY_LENGTH);
  return timingSafeEqual(actual, expected);
}
