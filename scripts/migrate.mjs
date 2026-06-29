// Apply every SQL file in supabase/migrations (sorted) against DATABASE_URL.
// Run: pnpm migrate   (loads .env.local via Node's native --env-file)
// Migrations are written idempotently (if-not-exists / on-conflict), so re-running is safe.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL is not set. Add your Supabase connection string (Settings → " +
      "Database → Connection string → URI) to .env.local, then run `pnpm migrate`.",
  );
  process.exit(1);
}

const dir = path.join(process.cwd(), "supabase", "migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const client = new pg.Client({ connectionString: url });

try {
  await client.connect();
  for (const file of files) {
    const sql = readFileSync(path.join(dir, file), "utf8");
    process.stdout.write(`applying ${file} … `);
    await client.query(sql);
    console.log("ok");
  }
  console.log(`\n✓ ${files.length} migration(s) applied.`);
} catch (err) {
  console.error("\n✗ migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
