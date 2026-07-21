/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { query } = require('../config/supabase');

const BACKUP_DIR = path.join(__dirname, '..', '..', 'db_backups');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUTPUT_FILE = path.join(BACKUP_DIR, `questions_backup_${TIMESTAMP}.json`);

async function runBackup() {
  console.log('Starting SARKARIPYQ Questions Table Backup...');

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`Created backup directory: ${BACKUP_DIR}`);
  }

  // Get total count of questions
  const { rows: countRows } = await query('SELECT COUNT(*)::int as count FROM questions');
  const totalQuestions = countRows[0].count;
  console.log(`Total questions in database: ${totalQuestions}`);

  const writeStream = fs.createWriteStream(OUTPUT_FILE);
  writeStream.write('[\n');

  const batchSize = 1000;
  let offset = 0;
  let writtenCount = 0;

  while (offset < totalQuestions) {
    console.log(`Fetching questions ${offset} to ${Math.min(totalQuestions, offset + batchSize)}...`);
    const { rows: questions } = await query(
      'SELECT * FROM questions ORDER BY id LIMIT $1 OFFSET $2',
      [batchSize, offset]
    );

    if (questions.length === 0) break;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const isLast = (offset + i === totalQuestions - 1);
      writeStream.write(JSON.stringify(q) + (isLast ? '\n' : ',\n'));
      writtenCount++;
    }

    offset += batchSize;
  }

  writeStream.write(']\n');
  writeStream.end();

  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => {
      console.log(`\nBackup completed successfully!`);
      console.log(`Saved ${writtenCount} questions to: ${OUTPUT_FILE}`);
      resolve(OUTPUT_FILE);
    });
    writeStream.on('error', reject);
  });
}

if (require.main === module) {
  runBackup().catch(console.error);
}

module.exports = { runBackup };
