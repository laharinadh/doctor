const request = require('supertest');
const app = require('../../app');
const db = require('../../config/database');

const durationMs = Number(process.env.SOAK_DURATION_MS || 60000);
const concurrency = Number(process.env.SOAK_CONCURRENCY || 100);

async function statusSnapshot() {
  const [rows] = await db.query("SHOW GLOBAL STATUS WHERE Variable_name IN ('Threads_connected', 'Threads_running')");
  return Object.fromEntries(rows.map((row) => [row.Variable_name, Number(row.Value)]));
}

async function main() {
  const [[patient]] = await db.query("SELECT id FROM users WHERE role = 'PATIENT' ORDER BY id LIMIT 1");
  const [[doctor]] = await db.query("SELECT id FROM users WHERE role = 'DOCTOR' ORDER BY id LIMIT 1");
  const [[admin]] = await db.query("SELECT id FROM users WHERE role = 'ADMIN' ORDER BY id LIMIT 1");
  const endpoints = [
    ['/api/v1/patient/doctors', patient.id],
    ['/api/v1/patient/appointments', patient.id],
    ['/api/v1/doctor/appointments', doctor.id],
    ['/api/v1/admin/dashboard', admin.id],
  ];
  const latencies = [];
  let successes = 0;
  let failures = 0;
  let timeouts = 0;
  let requestIndex = 0;
  const samples = [];
  const startedAt = Date.now();

  const sampleTimer = setInterval(async () => {
    const memory = process.memoryUsage();
    samples.push({
      elapsedMs: Date.now() - startedAt,
      rssMb: Number((memory.rss / 1024 / 1024).toFixed(2)),
      heapUsedMb: Number((memory.heapUsed / 1024 / 1024).toFixed(2)),
      database: await statusSnapshot(),
    });
  }, 10000);

  async function worker() {
    while (Date.now() - startedAt < durationMs) {
      const [url, userId] = endpoints[requestIndex++ % endpoints.length];
      const requestStarted = Date.now();
      try {
        const response = await request(app).get(url).set('x-test-user-id', String(userId)).timeout({ deadline: 10000 });
        latencies.push(Date.now() - requestStarted);
        if (response.status >= 200 && response.status < 400) successes += 1;
        else failures += 1;
      } catch (error) {
        failures += 1;
        if (error.code === 'ECONNABORTED') timeouts += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  clearInterval(sampleTimer);
  const memory = process.memoryUsage();
  samples.push({
    elapsedMs: Date.now() - startedAt,
    rssMb: Number((memory.rss / 1024 / 1024).toFixed(2)),
    heapUsedMb: Number((memory.heapUsed / 1024 / 1024).toFixed(2)),
    database: await statusSnapshot(),
  });
  latencies.sort((a, b) => a - b);
  const pick = (fraction) => latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * fraction) - 1)] || null;
  console.log(JSON.stringify({
    durationMs: Date.now() - startedAt,
    concurrency,
    requests: successes + failures,
    successes,
    failures,
    timeouts,
    latencyMs: { p50: pick(0.5), p95: pick(0.95), p99: pick(0.99), max: latencies.at(-1) || null },
    samples,
  }, null, 2));
  await db.end();
}

main().catch(async (error) => {
  console.error(error.stack || error);
  await db.end();
  process.exitCode = 1;
});
