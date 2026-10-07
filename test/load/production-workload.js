const request = require('supertest');
const app = require('../../app');
const db = require('../../config/database');

const TEST_DATE = process.env.LOAD_TEST_DATE || '2026-10-12';
const TEST_START = process.env.LOAD_TEST_START || '09:00:00';

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

function summarize(results, startedAt) {
  const latencies = results.filter((x) => x.latencyMs !== null).map((x) => x.latencyMs);
  const statusCounts = {};
  for (const result of results) {
    const key = result.status || result.error || 'UNKNOWN';
    statusCounts[key] = (statusCounts[key] || 0) + 1;
  }
  return {
    requests: results.length,
    durationMs: Date.now() - startedAt,
    statusCounts,
    errors: results.filter((x) => x.error || (x.status >= 500)).length,
    latencyMs: {
      p50: percentile(latencies, 0.50),
      p90: percentile(latencies, 0.90),
      p95: percentile(latencies, 0.95),
      p99: percentile(latencies, 0.99),
      max: latencies.length ? Math.max(...latencies) : null,
    },
  };
}

async function mysqlStatus() {
  const [rows] = await db.query("SHOW GLOBAL STATUS WHERE Variable_name IN ('Threads_connected', 'Threads_running')");
  return Object.fromEntries(rows.map((row) => [row.Variable_name, Number(row.Value)]));
}

async function call(method, url, userId, body = null) {
  const startedAt = Date.now();
  try {
    let req = request(app)[method](url).set('x-test-user-id', String(userId));
    if (body) req = req.send(body);
    const response = await req.timeout({ deadline: 10000 });
    return { status: response.status, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return { error: error.code || error.message, latencyMs: null };
  }
}

async function createRacePatients(count) {
  const users = [];
  for (let index = 0; index < count; index += 1) {
    const suffix = `${Date.now()}_${index}`;
    const phone = `+9198${String(Date.now()).slice(-8)}${String(index).padStart(2, '0')}`.slice(0, 20);
    const [userResult] = await db.query(
      'INSERT INTO users (firebase_uid, phone, email, role, status) VALUES (?, ?, ?, ?, ?)',
      [`load_race_${suffix}`, phone, `load_${suffix}@test.invalid`, 'PATIENT', 'ACTIVE']
    );
    const [patientResult] = await db.query(
      'INSERT INTO patients (user_id, name, phone, email) VALUES (?, ?, ?, ?)',
      [userResult.insertId, `Load Patient ${index}`, phone, `load_${suffix}@test.invalid`]
    );
    users.push({ userId: userResult.insertId, patientId: patientResult.insertId });
  }
  return users;
}

async function runRace() {
  const patients = await createRacePatients(20);
  const payload = {
    doctorId: 1,
    appointmentDate: TEST_DATE,
    startTime: TEST_START,
    consultationMode: 'VIDEO',
    meetingProvider: 'GOOGLE_MEET',
  };
  const startedAt = Date.now();
  const responses = await Promise.all(patients.map((p) => call('post', '/api/v1/patient/appointments', p.userId, payload)));
  const [appointments] = await db.query(
    `SELECT id, patient_id, doctor_id, appointment_date, start_time, status, payment_id
     FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND start_time = ?`,
    [payload.doctorId, payload.appointmentDate, payload.startTime]
  );
  const [payments] = await db.query(
    `SELECT COUNT(*) AS count FROM payments
     WHERE appointment_id IN (SELECT id FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND start_time = ?)`,
    [payload.doctorId, payload.appointmentDate, payload.startTime]
  );
  return {
    workload: 'appointment-race',
    expected: { successfulHolds: 1, rejectedHolds: 19, duplicateAppointments: 0, paymentRows: 0 },
    observed: summarize(responses, startedAt),
    appointments,
    paymentRows: Number(payments[0].count),
  };
}

async function runAuthenticatedWorkload() {
  const [[patient]] = await db.query("SELECT id FROM users WHERE role = 'PATIENT' ORDER BY id LIMIT 1");
  const [[doctor]] = await db.query("SELECT id FROM users WHERE role = 'DOCTOR' ORDER BY id LIMIT 1");
  const [[admin]] = await db.query("SELECT id FROM users WHERE role = 'ADMIN' ORDER BY id LIMIT 1");
  const endpoints = [
    ['get', '/api/v1/patient/doctors', patient.id],
    ['get', `/api/v1/patient/doctors/1/slots?date=${TEST_DATE}`, patient.id],
    ['get', '/api/v1/patient/appointments', patient.id],
    ['get', '/api/v1/doctor/appointments', doctor.id],
    ['get', '/api/v1/admin/dashboard', admin.id],
  ];
  const stages = {};
  for (const concurrency of [10, 25, 50, 100, 250, 500, 1000]) {
    const requests = [];
    for (let index = 0; index < concurrency; index += 1) {
      const [method, url, userId] = endpoints[index % endpoints.length];
      requests.push(call(method, url, userId));
    }
    const before = await mysqlStatus();
    const startedAt = Date.now();
    const results = await Promise.all(requests);
    const after = await mysqlStatus();
    stages[concurrency] = { before, after, ...summarize(results, startedAt) };
  }
  return { workload: 'authenticated-database', stages };
}

(async () => {
  const mode = process.argv[2] || 'all';
  const report = {
    environment: {
      nodeEnv: process.env.NODE_ENV,
      authMode: process.env.AUTH_MODE,
      database: process.env.DB_NAME,
      connectionLimit: process.env.DB_CONNECTION_LIMIT,
    },
    ...(mode === 'all' || mode === 'race' ? { race: await runRace() } : {}),
    ...(mode === 'all' || mode === 'workload' ? { authenticated: await runAuthenticatedWorkload() } : {}),
  };
  console.log(JSON.stringify(report, null, 2));
  await db.end();
})().catch(async (error) => {
  console.error(error.stack || error);
  await db.end();
  process.exitCode = 1;
});
