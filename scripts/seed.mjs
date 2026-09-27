import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { config } from "dotenv";

config({ path: path.join(process.cwd(), ".env.local") });

const seedDir = path.join(process.cwd(), "supabase", "seed");

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error("SUPABASE_DB_URL is not set. Add it to .env.local (Project Settings > Database).");
    process.exit(1);
  }

  const files = (await readdir(seedDir)).filter((f) => f.endsWith(".sql")).sort();
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    for (const file of files) {
      const sql = await readFile(path.join(seedDir, file), "utf8");
      console.log(`Seeding ${file} ...`);
      await client.query(sql);
    }
    console.log(`Ran ${files.length} seed file(s).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
