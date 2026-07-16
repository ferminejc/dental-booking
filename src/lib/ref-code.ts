// Excludes 0/O and 1/I so codes are easy to read back over the phone.
export const REF_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRefCode(): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += REF_CODE_ALPHABET[Math.floor(Math.random() * REF_CODE_ALPHABET.length)];
  }
  return `DNT-${suffix}`;
}
