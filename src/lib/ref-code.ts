// Excludes 0/O and 1/I so codes are easy to read back over the phone.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRefCode(): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `DNT-${suffix}`;
}
