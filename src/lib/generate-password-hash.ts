// Run: npm run auth:hash -- "some-password"
// Unlike src/db/seed.ts, this script reads no env vars and never imports
// src/db/client.ts (directly or transitively), so it doesn't need `./load-env`.
import { hashPassword } from "./password";

const plain = process.argv[2];
if (!plain) {
  console.error("Usage: npm run auth:hash -- <password>");
  process.exit(1);
}

console.log(hashPassword(plain));
