// Side-effect import: loads .env.local for standalone scripts (seed, etc.)
// run outside Next.js, which loads .env.local into process.env itself.
// Must be imported before any module that reads process.env at module-load
// time (e.g. ./client), and before that module's own import statement, since
// import statements execute in the order they're written.
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
