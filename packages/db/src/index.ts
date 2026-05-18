import * as dotenv from "dotenv";
import { neonConfig, Pool as NeonPool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless"; // ← changed
import type { NeonDatabase } from "drizzle-orm/neon-serverless";       // ← changed
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  drizzle as drizzleVercel,
  type VercelPgDatabase,
} from "drizzle-orm/vercel-postgres";
import { createPool as createVercelPool } from "@vercel/postgres";
import pg from "pg";
import * as schema from "./schema/index.js";
import { logger } from "@repo/logger";

// Required for Neon WebSocket driver in Node.js environments
import ws from "ws";
neonConfig.webSocketConstructor = ws; // ← needed outside of browser/edge runtimes

dotenv.config({ path: [".env.local", ".env"] });

const databaseUrl = process.env.DATABASE_URL;
const vercelPostgresUrl = process.env.POSTGRES_URL;
const runningOnVercel = !!process.env.VERCEL;

export enum ConnectionType {
  VERCEL_POSTGRES = "VERCEL_POSTGRES",
  NEON = "NEON",
  VERCEL_EXTERNAL_POOL = "VERCEL_EXTERNAL_POOL",
  STANDARD_POOL = "STANDARD_POOL",
  INVALID = "INVALID",
}

const getConnectionType = (
  dbUrl: string | undefined,
  vercelUrl: string | undefined,
  isOnVercel: boolean
): ConnectionType => {
  if (vercelUrl) return ConnectionType.VERCEL_POSTGRES;
  if (dbUrl && dbUrl.includes(".neon.tech")) return ConnectionType.NEON;
  if (isOnVercel && dbUrl) return ConnectionType.VERCEL_EXTERNAL_POOL;
  if (dbUrl) return ConnectionType.STANDARD_POOL;
  return ConnectionType.INVALID;
};

if (!databaseUrl && !vercelPostgresUrl) {
  console.error("At least one of DATABASE_URL or POSTGRES_URL must be set!");
  throw new Error(
    "Please set DATABASE_URL or POSTGRES_URL in your environment."
  );
}

export type DatabaseType =
  | VercelPgDatabase<typeof schema>
  | NeonDatabase<typeof schema>   // ← updated type
  | NodePgDatabase<typeof schema>;

let db: DatabaseType;
const connectionType = getConnectionType(
  databaseUrl,
  vercelPostgresUrl,
  runningOnVercel
);

const poolSize = 10;

switch (connectionType) {
  case ConnectionType.VERCEL_POSTGRES:
    logger.log("Using Vercel Postgres pool driver (POSTGRES_URL detected)");
    db = drizzleVercel(
      createVercelPool({ connectionString: vercelPostgresUrl! }),
      { schema }
    );
    break;

  case ConnectionType.NEON:
    logger.log(
      "Using Neon WebSocket pool driver (DATABASE_URL contains .neon.tech)"
    );
    // Use Pool (WebSocket) instead of neon() (HTTP) — enables transaction support
    db = drizzleNeon(
      new NeonPool({ connectionString: databaseUrl! }),
      { schema }
    );
    break;

  case ConnectionType.VERCEL_EXTERNAL_POOL:
    logger.warn(
      "Using standard pg.Pool with external DATABASE_URL on Vercel. Ensure the URL points to a pooler."
    );
    logger.warn(
      "[CRITICAL] Ensure the pooler mode is set to 'transaction' mode."
    );
    db = drizzlePg(
      new pg.Pool({ connectionString: databaseUrl!, max: 1 }),
      { schema }
    );
    break;

  case ConnectionType.STANDARD_POOL:
    logger.log(
      "Using standard PostgreSQL driver (pg.Pool) with DATABASE_URL (Not on Vercel/Neon)"
    );
    logger.log(`Using pg.Pool with pool size: ${poolSize}`);
    db = drizzlePg(
      new pg.Pool({ connectionString: databaseUrl!, max: poolSize }),
      { schema }
    );
    break;

  case ConnectionType.INVALID:
  default:
    logger.error("Could not determine database connection method.");
    throw new Error("Invalid database configuration state.");
}

export { db };
export { seed } from "./seeds/run.js";
export * from "./schema/index.js";
export * from "./registry/index.js";
export { runRawSqlMigration } from "./utils.js";