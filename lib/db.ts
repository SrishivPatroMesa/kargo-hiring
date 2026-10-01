import postgres from "postgres";

// One connection pool per server instance. Works with Supabase (use the "Transaction pooler"
// connection string, port 6543) and Neon. prepare:false is required for poolers.
const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

export const sql =
  globalForDb.sql ??
  postgres(process.env.DATABASE_URL || "postgres://missing-DATABASE_URL", {
    prepare: false,
    max: 3,
    idle_timeout: 20,
    ssl: process.env.DATABASE_URL?.includes("localhost") ? false : "require",
  });

if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;

export type Role = "PM" | "SPM";
export const ROLES: Role[] = ["PM", "SPM"];
