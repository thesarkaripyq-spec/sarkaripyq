import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { config } from "dotenv";

config({ path: path.join(process.cwd(), ".env.local") });

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error("SUPABASE_DB_URL is not set. Add it to .env.local (Project Settings > Database).");
    process.exit(1);
  }

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    for (const file of files) {
      const sql = await readFile(path.join(migrationsDir, file), "utf8");
      console.log(`Applying ${file} ...`);
      await client.query(sql);
    }
    console.log(`Applied ${files.length} migration(s).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
