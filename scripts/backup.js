const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const config = require('../config');

async function createBackup(backupDir = path.resolve(__dirname, '../database/backups')) {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `backup-${config.db.database}-${timestamp}.json`;
  const backupFilePath = path.join(backupDir, backupFileName);

  console.log(`\n======================================================`);
  console.log(`📦 STARTING DATABASE BACKUP: ${config.db.database}`);
  console.log(`======================================================`);

  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
  });

  try {
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map((t) => Object.values(t)[0]);

    console.log(`Found ${tableNames.length} tables to backup...`);

    const backupData = {
      database: config.db.database,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      tables: {},
      stats: {
        totalTables: tableNames.length,
        totalRows: 0,
      },
    };

    for (const table of tableNames) {
      // 1. Fetch schema DDL
      const [createTableResult] = await connection.query(`SHOW CREATE TABLE \`${table}\``);
      const ddl = createTableResult[0]['Create Table'];

      // 2. Fetch rows
      const [rows] = await connection.query(`SELECT * FROM \`${table}\``);

      backupData.tables[table] = {
        ddl,
        rowCount: rows.length,
        data: rows,
      };

      backupData.stats.totalRows += rows.length;
      console.log(` - Backed up table \`${table}\`: ${rows.length} rows`);
    }

    const jsonString = JSON.stringify(backupData, null, 2);
    fs.writeFileSync(backupFilePath, jsonString, 'utf8');

    // Generate SHA-256 Checksum for disaster recovery validation
    const checksum = crypto.createHash('sha256').update(jsonString).digest('hex');
    const meta = {
      backupFile: backupFileName,
      backupFilePath,
      fileSizeBytes: Buffer.byteLength(jsonString, 'utf8'),
      sha256Checksum: checksum,
      createdAt: backupData.timestamp,
      totalTables: backupData.stats.totalTables,
      totalRows: backupData.stats.totalRows,
    };

    const metaPath = path.join(backupDir, `${backupFileName}.meta.json`);
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');

    console.log(`\n✅ Backup successfully generated!`);
    console.log(`📁 File: ${backupFilePath}`);
    console.log(`🔒 SHA-256 Checksum: ${checksum}`);
    console.log(`📊 Total Tables: ${meta.totalTables} | Total Rows: ${meta.totalRows}`);

    return meta;
  } finally {
    await connection.end();
  }
}

function verifyBackupIntegrity(backupFilePath, metaFilePath) {
  if (!fs.existsSync(backupFilePath) || !fs.existsSync(metaFilePath)) {
    throw new Error('Backup or metadata file does not exist');
  }

  const content = fs.readFileSync(backupFilePath, 'utf8');
  const meta = JSON.parse(fs.readFileSync(metaFilePath, 'utf8'));

  const computedChecksum = crypto.createHash('sha256').update(content).digest('hex');
  const valid = computedChecksum === meta.sha256Checksum;

  if (!valid) {
    throw new Error(`Checksum mismatch! Expected: ${meta.sha256Checksum}, Got: ${computedChecksum}`);
  }

  const parsed = JSON.parse(content);
  return {
    verified: true,
    tablesCount: Object.keys(parsed.tables).length,
    checksum: computedChecksum,
    totalRows: parsed.stats.totalRows,
  };
}

if (require.main === module) {
  createBackup()
    .then((meta) => {
      console.log('Testing integrity verification...');
      const check = verifyBackupIntegrity(meta.backupFilePath, `${meta.backupFilePath}.meta.json`);
      console.log('🎉 Verification passed:', check);
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Backup failed:', err);
      process.exit(1);
    });
}

module.exports = {
  createBackup,
  verifyBackupIntegrity,
};
