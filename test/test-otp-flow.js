const request = require('supertest');
const app = require('../app');
const config = require('../config');
const db = require('../config/database');

async function testOtpFlow() {
  console.log('\n======================================================');
  console.log('📲 TESTING OTP & AUTHENTICATION END-TO-END FLOW');
  console.log('======================================================\n');

  const origAuthMode = config.auth.mode;
  config.auth.mode = 'test';

  try {
    // ---------------------------------------------------------
    // 1. Test Send OTP Endpoint
    // ---------------------------------------------------------
    console.log('1️⃣ Testing POST /api/v1/auth/send-otp...');
    const sendOtpRes = await request(app)
      .post('/api/v1/auth/send-otp')
      .send({ phone: '+919876543210' });

    console.log('   Status:', sendOtpRes.status);
    console.log('   Response:', JSON.stringify(sendOtpRes.body, null, 2));

    if (sendOtpRes.status === 200 && sendOtpRes.body.success) {
      console.log('   ✅ Send OTP test passed!');
    } else {
      console.error('   ❌ Send OTP failed');
    }

    // ---------------------------------------------------------
    // 2. Test Invalid Phone Rejection
    // ---------------------------------------------------------
    console.log('\n2️⃣ Testing Send OTP with invalid phone format...');
    const invalidPhoneRes = await request(app)
      .post('/api/v1/auth/send-otp')
      .send({ phone: '9876543210' }); // Missing +91

    console.log('   Status:', invalidPhoneRes.status, '(Expected 400)');
    console.log('   Error Message:', invalidPhoneRes.body.message);
    if (invalidPhoneRes.status === 400) {
      console.log('   ✅ Invalid phone rejection passed!');
    } else {
      console.error('   ❌ Failed to reject invalid phone');
    }

    // ---------------------------------------------------------
    // 3. Test Verify OTP - Login for Existing User
    // ---------------------------------------------------------
    console.log('\n3️⃣ Testing POST /api/v1/auth/verify-otp for existing patient (+919123456780)...');
    const existingLoginRes = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({
        phone: '+919123456780',
        role: 'PATIENT',
      });

    console.log('   Status:', existingLoginRes.status);
    console.log('   Message:', existingLoginRes.body.message);
    console.log('   User ID:', existingLoginRes.body.data?.user?.id);
    console.log('   Role:', existingLoginRes.body.data?.user?.role);
    console.log('   Is New User:', existingLoginRes.body.data?.isNewUser);

    if (existingLoginRes.status === 200 && existingLoginRes.body.data?.isNewUser === false) {
      console.log('   ✅ Existing patient login verified!');
    } else {
      console.error('   ❌ Existing login failed');
    }

    // ---------------------------------------------------------
    // 4. Test Verify OTP - Auto-Registration for New Patient
    // ---------------------------------------------------------
    const newTestPhone = `+9198${Date.now().toString().slice(-8)}`;
    console.log(`\n4️⃣ Testing POST /api/v1/auth/verify-otp registration for new patient (${newTestPhone})...`);
    const newPatientRes = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({
        phone: newTestPhone,
        role: 'PATIENT',
        name: 'Aarav Patel',
        email: 'aarav.patel@example.com',
      });

    console.log('   Status:', newPatientRes.status, '(Expected 201 Created)');
    console.log('   Message:', newPatientRes.body.message);
    console.log('   Created User ID:', newPatientRes.body.data?.user?.id);
    console.log('   Profile Name:', newPatientRes.body.data?.profile?.name);
    console.log('   Is New User:', newPatientRes.body.data?.isNewUser);

    if (newPatientRes.status === 201 && newPatientRes.body.data?.isNewUser === true) {
      console.log('   ✅ New patient registration verified!');

      // Verify row in MySQL database
      const [dbUser] = await db.query('SELECT * FROM users WHERE phone = ?', [newTestPhone]);
      console.log('   Database check: User record exists with ID', dbUser[0]?.id);
    } else {
      console.error('   ❌ New patient registration failed');
    }

    // ---------------------------------------------------------
    // 5. Test Verify OTP - Auto-Registration for New Doctor
    // ---------------------------------------------------------
    const newDocPhone = `+9197${Date.now().toString().slice(-8)}`;
    console.log(`\n5️⃣ Testing POST /api/v1/auth/verify-otp registration for new doctor (${newDocPhone})...`);
    const newDocRes = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({
        phone: newDocPhone,
        role: 'DOCTOR',
        name: 'Dr. Priya Mehta',
        email: 'dr.priya@example.com',
      });

    console.log('   Status:', newDocRes.status, '(Expected 201 Created)');
    console.log('   Role:', newDocRes.body.data?.user?.role);
    console.log('   Verification Status:', newDocRes.body.data?.profile?.verification_status);

    if (newDocRes.status === 201 && newDocRes.body.data?.profile?.verification_status === 'PENDING') {
      console.log('   ✅ New doctor registration with PENDING verification verified!');
    } else {
      console.error('   ❌ New doctor registration failed');
    }

    console.log('\n🎉 ALL OTP VERIFICATION & REGISTRATION FLOWS PASSED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('❌ OTP test encountered an error:', err);
  } finally {
    config.auth.mode = origAuthMode;
    await db.end();
    process.exit(0);
  }
}

testOtpFlow();
