#!/usr/bin/env node
/* eslint-disable no-console */
// SARKARIPYQ Database Migration Runner
// Usage:
//   node scripts/migrate.js              # Apply pending migrations
//   node scripts/migrate.js --dry-run    # Show what would be applied
//   node scripts/migrate.js --status     # Show migration status
//   node scripts/migrate.js --down=003   # Revert a specific migration (future)

const fs = require('fs');
const path = require('path');

require('dotenv').config();
const { pool } = require('../config/database');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'db', 'migrations');
const MIGRATIONS_TABLE = '_migrations';

const args = process.argv.slice(2);
const flags = {
  dryRun: args.includes('--dry-run'),
  status: args.includes('--status'),
  down: args.find(a => a.startsWith('--down='))?.split('=')[1],
};

async function ensureMetaTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW(),
      duration_ms INT
    )
  `);
}

async function getApplied() {
  const { rows } = await pool.query(
    `SELECT name, checksum, applied_at, duration_ms FROM ${MIGRATIONS_TABLE} ORDER BY name`
  );
  return rows;
}

async function recordApplied(name, checksum, durationMs) {
  await pool.query(
    `INSERT INTO ${MIGRATIONS_TABLE} (name, checksum, duration_ms) VALUES ($1, $2, $3)
     ON CONFLICT (name) DO NOTHING`,
    [name, checksum, durationMs]
  );
}

function sha256(content) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

async function run() {
  console.log('SARKARIPYQ Migration Runner');
  console.log('='.repeat(40));
  console.log(`Migrations directory: ${MIGRATIONS_DIR}`);
  console.log();

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migration files found.');
    await pool.end();
    return;
  }

  await ensureMetaTable();
  const applied = await getApplied();
  const appliedNames = new Set(applied.map(r => r.name));

  if (flags.status) {
    console.log('Migration Status:');
    console.log();
    for (const file of files) {
      const fullPath = path.join(MIGRATIONS_DIR, file);
      const content = fs.readFileSync(fullPath, 'utf8');
      const checksum = sha256(content);
      const isAppliedFlag = appliedNames.has(file);
      const record = applied.find(r => r.name === file);
      const checksumMatch = record && record.checksum === checksum;
      console.log(
        `  ${isAppliedFlag ? '✓' : ' '} ${file}` +
        (isAppliedFlag ? ` (applied ${record.applied_at.toISOString().split('T')[0]}, ${record.duration_ms}ms)` : '') +
        (isAppliedFlag && !checksumMatch ? ' ⚠ CHECKSUM MISMATCH' : '')
      );
    }
    console.log();
    console.log(`Total: ${applied.length}/${files.length} applied`);
    await pool.end();
    return;
  }

  const pending = files.filter(f => !appliedNames.has(f));

  if (pending.length === 0) {
    console.log('All migrations are applied.');
    await pool.end();
    return;
  }

  console.log(`Found ${pending.length} pending migration(s):`);
  pending.forEach(f => console.log(`  - ${f}`));
  console.log();

  for (const file of pending) {
    const fullPath = path.join(MIGRATIONS_DIR, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    const checksum = sha256(content);

    console.log(`Applying: ${file}`);

    if (flags.dryRun) {
      console.log(`  [DRY-RUN] Would execute ${content.split(';').length} statement(s)`);
      continue;
    }

    const start = Date.now();
    try {
      await pool.query(content);
      const duration = Date.now() - start;
      await recordApplied(file, checksum, duration);
      console.log(`  ✓ Applied in ${duration}ms`);
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`);
      console.error('  Migration aborted. Manual intervention required.');
      await pool.end();
      process.exit(1);
    }
  }

  console.log();
  console.log('All migrations applied successfully.');
  await pool.end();
}

run().catch(err => {
  console.error('Migration runner error:', err);
  process.exit(1);
});
