import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Neon requires TLS; the sslmode=require in the connection string doesn't
// stop node-postgres from also needing an explicit ssl option.
export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});
