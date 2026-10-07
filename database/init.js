const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const host = process.env.DB_HOST || 'localhost';
const port = parseInt(process.env.DB_PORT || '3306', 10);
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';
const databaseName = process.env.DB_NAME || 'doctor_consultation';

async function initDatabase() {
  console.log(`🔌 Attempting to connect to MySQL on ${host}:${port} as user '${user}'...`);

  let connection;
  try {
    // Connect without database first to ensure server is reachable
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true,
    });
    console.log('✅ Connected to MySQL server successfully!');
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('👉 Tip: Please check DB_USER and DB_PASSWORD in your .env file.');
    } else if (err.code === 'ECONNREFUSED') {
      console.error('👉 Tip: Make sure the MySQL Windows Service is running (run: net start MySQL80).');
    }
    process.exit(1);
  }

  try {
    console.log(`📦 Creating database '${databaseName}' if not exists...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${databaseName}\`;`);

    console.log('📄 Reading database/schema.sql...');
    const schemaSql = fs.readFileSync(path.resolve(__dirname, 'schema.sql'), 'utf8');

    console.log('⚡ Executing schema SQL script (creating 16 tables)...');
    await connection.query(schemaSql);

    console.log('✅ All 16 tables created successfully!');

    // Show list of created tables
    const [tables] = await connection.query('SHOW TABLES;');
    const tableNames = tables.map((t) => Object.values(t)[0]);
    console.log(`📊 Verified ${tableNames.length} tables in database:`);
    console.log(tableNames.map((name) => `   - ${name}`).join('\n'));

    console.log('\n🎉 Database initialization finished successfully!');
  } catch (err) {
    console.error('❌ Error executing schema:', err.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initDatabase();
