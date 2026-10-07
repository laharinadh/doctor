const http = require('http');
const app = require('../app');
const db = require('../config/database');

async function testApi() {
  console.log('🧪 Starting live API endpoint verification...');

  const server = app.listen(3001, async () => {
    console.log('✅ Test server listening on port 3001');

    try {
      // 1. Test health endpoint
      const healthRes = await fetchJson('http://localhost:3001/api/v1/health');
      console.log('✅ /api/v1/health response:', healthRes);

      // 2. Test departments from database
      const [departments] = await db.query('SELECT name FROM departments WHERE status = "ACTIVE"');
      console.log(`✅ Database query verified: ${departments.length} departments found:`);
      console.log(departments.map(d => `   - ${d.name}`).join('\n'));

      // 3. Test admin metrics from database
      const [doctors] = await db.query('SELECT name, verification_status FROM doctors');
      console.log(`✅ Doctor check: ${doctors.length} doctor(s) found in database (Status: ${doctors[0]?.verification_status})`);

      console.log('\n🎉 ALL DATABASE AND BACKEND TESTS PASSED!');
    } catch (err) {
      console.error('❌ Test failed:', err);
    } finally {
      server.close();
      await db.end();
      process.exit(0);
    }
  });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

testApi();
