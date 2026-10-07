const request = require('supertest');
const app = require('../../app');
const db = require('../../config/database');

async function main() {
  const [[patientA]] = await db.query("SELECT id FROM users WHERE role = 'PATIENT' ORDER BY id LIMIT 1");
  const [[doctor]] = await db.query("SELECT id FROM users WHERE role = 'DOCTOR' ORDER BY id LIMIT 1");
  const [[admin]] = await db.query("SELECT id FROM users WHERE role = 'ADMIN' ORDER BY id LIMIT 1");

  const phone = `+9196${String(Date.now()).slice(-8)}`;
  const [userResult] = await db.query(
    'INSERT INTO users (firebase_uid, phone, email, role, status) VALUES (?, ?, ?, ?, ?)',
    [`matrix_${Date.now()}`, phone, `matrix_${Date.now()}@test.invalid`, 'PATIENT', 'ACTIVE']
  );
  const [patientResult] = await db.query(
    'INSERT INTO patients (user_id, name, phone, email) VALUES (?, ?, ?, ?)',
    [userResult.insertId, 'Synthetic Patient B', phone, `matrix_${Date.now()}@test.invalid`]
  );

  const pdf = Buffer.from('%PDF-1.7 synthetic medical record');
  const upload = await request(app)
    .post('/api/v1/patient/medical-records')
    .set('x-test-user-id', String(patientA.id))
    .attach('file', pdf, { filename: 'synthetic.pdf', contentType: 'application/pdf' });
  const recordId = upload.body.data && upload.body.data.id;

  const checks = {
    upload: upload.status,
    ownerDownload: null,
    otherPatientDownload: null,
    doctorDownload: null,
    adminDownload: null,
    otherPatientListCount: null,
    invalidMimeUpload: null,
    oversizedUpload: null,
  };

  if (recordId) {
    checks.ownerDownload = (await request(app)
      .get(`/api/v1/patient/medical-records/${recordId}/download`)
      .set('x-test-user-id', String(patientA.id))).status;
    checks.otherPatientDownload = (await request(app)
      .get(`/api/v1/patient/medical-records/${recordId}/download`)
      .set('x-test-user-id', String(userResult.insertId))).status;
    checks.doctorDownload = (await request(app)
      .get(`/api/v1/patient/medical-records/${recordId}/download`)
      .set('x-test-user-id', String(doctor.id))).status;
    checks.adminDownload = (await request(app)
      .get(`/api/v1/patient/medical-records/${recordId}/download`)
      .set('x-test-user-id', String(admin.id))).status;
    const otherList = await request(app)
      .get('/api/v1/patient/medical-records')
      .set('x-test-user-id', String(userResult.insertId));
    checks.otherPatientListCount = Array.isArray(otherList.body.data) ? otherList.body.data.length : null;
  }

  checks.invalidMimeUpload = (await request(app)
    .post('/api/v1/patient/medical-records')
    .set('x-test-user-id', String(patientA.id))
    .attach('file', Buffer.from('<script>not pdf</script>'), { filename: 'bad.js', contentType: 'application/javascript' })).status;
  const oversized = Buffer.concat([Buffer.from('%PDF-1.7 '), Buffer.alloc(102401, 65)]);
  checks.oversizedUpload = (await request(app)
    .post('/api/v1/patient/medical-records')
    .set('x-test-user-id', String(patientA.id))
    .attach('file', oversized, { filename: 'large.pdf', contentType: 'application/pdf' })).status;

  console.log(JSON.stringify({
    expected: {
      upload: 201,
      ownerDownload: 200,
      otherPatientDownload: 403,
      doctorDownload: 403,
      adminDownload: 403,
      otherPatientListCount: 0,
      invalidMimeUpload: 400,
      oversizedUpload: 400,
    },
    observed: checks,
  }, null, 2));
  await db.end();
}

main().catch(async (error) => {
  console.error(error.stack || error);
  await db.end();
  process.exitCode = 1;
});
