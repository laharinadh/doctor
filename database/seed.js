const db = require('../config/database');
const { ROLES, USER_STATUS, DOCTOR_VERIFICATION_STATUS } = require('../utils/constants');

async function seed() {
  console.log('🌱 Starting database seeding...');

  try {
    // 1. Seed Platform Settings if missing
    const [settings] = await db.query('SELECT id FROM platform_settings LIMIT 1');
    if (!settings.length) {
      await db.query('INSERT INTO platform_settings (platform_fee, currency, active) VALUES (?, ?, ?)', [99.00, 'INR', 1]);
      console.log('✅ Default platform settings seeded (₹99.00)');
    }

    // 2. Seed Default Departments
    const defaultDepartments = [
      { name: 'General Medicine', description: 'Comprehensive primary care and diagnosis of adult conditions' },
      { name: 'Cardiology', description: 'Heart, circulation, and vascular health management' },
      { name: 'Dermatology', description: 'Skin, hair, and nail health and clinical treatments' },
      { name: 'Pediatrics', description: 'Medical care for infants, children, and adolescents' },
      { name: 'Orthopedics', description: 'Musculoskeletal system, bone fractures, joints and spine' },
      { name: 'Neurology', description: 'Disorders of the nervous system and brain health' },
      { name: 'Gynecology', description: 'Female reproductive health and maternal medicine' },
      { name: 'ENT', description: 'Ear, Nose, and Throat specialized clinical care' },
    ];

    for (const dept of defaultDepartments) {
      await db.query(
        'INSERT IGNORE INTO departments (name, description, status) VALUES (?, ?, ?)',
        [dept.name, dept.description, 'ACTIVE']
      );
    }
    console.log(`✅ ${defaultDepartments.length} Departments seeded`);

    // 3. Seed Root Admin User
    const adminPhone = '+919999999999';
    const adminUid = 'admin_root_uid';
    const [existingAdmin] = await db.query('SELECT id FROM users WHERE phone = ?', [adminPhone]);

    let adminId;
    if (!existingAdmin.length) {
      const [res] = await db.query(
        'INSERT INTO users (firebase_uid, phone, email, role, status) VALUES (?, ?, ?, ?, ?)',
        [adminUid, adminPhone, 'admin@doctorplatform.com', ROLES.ADMIN, USER_STATUS.ACTIVE]
      );
      adminId = res.insertId;
      console.log(`✅ Admin user seeded (ID: ${adminId}, Phone: ${adminPhone})`);
    } else {
      adminId = existingAdmin[0].id;
      console.log(`ℹ️ Admin user already exists (ID: ${adminId})`);
    }

    // 4. Seed Sample Verified Doctor for immediate testing
    const doctorPhone = '+919876543210';
    const doctorUid = 'doctor_sample_uid';
    const [existingDoctorUser] = await db.query('SELECT id FROM users WHERE phone = ?', [doctorPhone]);

    if (!existingDoctorUser.length) {
      const [deptRows] = await db.query('SELECT id FROM departments WHERE name = ? LIMIT 1', ['General Medicine']);
      const deptId = deptRows.length ? deptRows[0].id : null;

      const [res] = await db.query(
        'INSERT INTO users (firebase_uid, phone, email, role, status) VALUES (?, ?, ?, ?, ?)',
        [doctorUid, doctorPhone, 'dr.sharma@example.com', ROLES.DOCTOR, USER_STATUS.ACTIVE]
      );
      const doctorUserId = res.insertId;

      const [docRes] = await db.query(
        `INSERT INTO doctors 
          (user_id, name, phone, email, department_id, registration_number, qualification, experience_years, bio, consultation_fee, verification_status, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          doctorUserId,
          'Dr. Rajesh Sharma, MD',
          doctorPhone,
          'dr.sharma@example.com',
          deptId,
          'MCI-2015-8899',
          'MBBS, MD - General Medicine (AIIMS)',
          10,
          'Senior consultant physician specializing in preventive cardiology and metabolic health.',
          500.00,
          DOCTOR_VERIFICATION_STATUS.APPROVED,
          USER_STATUS.ACTIVE,
        ]
      );
      const docId = docRes.insertId;

      // Add a Monday to Friday schedule (9:00 AM to 1:00 PM, 30 min slots)
      for (let day = 1; day <= 5; day++) {
        await db.query(
          `INSERT INTO doctor_schedules 
            (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, status)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [docId, day, '09:00:00', '13:00:00', 30, 'ACTIVE']
        );
      }
      console.log(`✅ Sample Doctor seeded (ID: ${docId}, Phone: ${doctorPhone}, Mon-Fri schedules created)`);
    }

    // 5. Seed Sample Patient for immediate testing
    const patientPhone = '+919123456780';
    const patientUid = 'patient_sample_uid';
    const [existingPatientUser] = await db.query('SELECT id FROM users WHERE phone = ?', [patientPhone]);

    if (!existingPatientUser.length) {
      const [res] = await db.query(
        'INSERT INTO users (firebase_uid, phone, email, role, status) VALUES (?, ?, ?, ?, ?)',
        [patientUid, patientPhone, 'rahul.verma@example.com', ROLES.PATIENT, USER_STATUS.ACTIVE]
      );
      const patientUserId = res.insertId;

      const [patRes] = await db.query(
        'INSERT INTO patients (user_id, name, phone, email, height_cm, weight_kg) VALUES (?, ?, ?, ?, ?, ?)',
        [patientUserId, 'Rahul Verma', patientPhone, 'rahul.verma@example.com', 175.0, 70.0]
      );
      console.log(`✅ Sample Patient seeded (ID: ${patRes.insertId}, Phone: ${patientPhone})`);
    }

    console.log('🎉 Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seed();
