import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

if (!process.env.DATABASE_URL_TEST) {
  throw new Error("DATABASE_URL_TEST is not set");
}

const sql = neon(process.env.DATABASE_URL_TEST);

export const testDb = drizzle(sql, { schema });
