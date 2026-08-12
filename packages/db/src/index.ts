import { env } from "@khoroch/env/server";
import { drizzle } from "drizzle-orm/node-postgres";

import { getDatabaseUrl } from "./database-url";
import * as schema from "./schema";

export function createDb() {
  return drizzle(getDatabaseUrl(env.DATABASE_URL), { schema });
}

export const db = createDb();
