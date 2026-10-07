const db = require('../../config/database');

async function main() {
  const queries = {
    doctorDiscovery: `EXPLAIN SELECT d.id, d.name, dept.name AS department_name
      FROM doctors d LEFT JOIN departments dept ON d.department_id = dept.id
      WHERE d.verification_status = 'APPROVED' AND d.status = 'ACTIVE'
      ORDER BY d.created_at DESC LIMIT 20 OFFSET 0`,
    appointments: `EXPLAIN SELECT a.id, a.appointment_date, a.start_time, a.status
      FROM appointments a WHERE a.patient_id = 2
      ORDER BY a.appointment_date DESC, a.start_time DESC LIMIT 20 OFFSET 0`,
    adminPatients: "EXPLAIN SELECT COUNT(*) AS total FROM users WHERE role = 'PATIENT'",
  };
  const report = {};
  for (const [name, query] of Object.entries(queries)) {
    const [rows] = await db.query(query);
    report[name] = rows.map((row) => ({ table: row.table, type: row.type, key: row.key, rows: row.rows, extra: row.Extra }));
  }
  const [status] = await db.query("SHOW GLOBAL STATUS WHERE Variable_name IN ('Threads_connected', 'Threads_running', 'Threads_created', 'Threads_cached')");
  report.mysqlStatus = Object.fromEntries(status.map((row) => [row.Variable_name, Number(row.Value)]));
  console.log(JSON.stringify(report, null, 2));
  await db.end();
}

main().catch(async (error) => {
  console.error(error.stack || error);
  await db.end();
  process.exitCode = 1;
});
