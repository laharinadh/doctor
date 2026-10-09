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

    // 4. Seed Sample Verified Doctors across all departments for immediate testing
    const defaultDoctors = [
      { name: 'Dr. Rajesh Sharma, MD', phone: '+919876543210', email: 'dr.sharma@example.com', dept: 'General Medicine', qualification: 'MBBS, MD - General Medicine (AIIMS)', reg: 'MCI-2015-8899', exp: 10, fee: 500, bio: 'Senior consultant physician specializing in preventive health and metabolic conditions.' },
      { name: 'Dr. Ananya Rao', phone: '+919876543212', email: 'dr.rao@example.com', dept: 'Cardiology', qualification: 'MBBS, MD (Cardiology), DM', reg: 'MCI-2016-4013', exp: 12, fee: 600, bio: 'Comprehensive heart care, preventive screening, and vascular treatment.' },
      { name: 'Dr. Vikram Shah', phone: '+919876543218', email: 'dr.shah@example.com', dept: 'Dermatology', qualification: 'MBBS, MD (Dermatology)', reg: 'MCI-2017-4027', exp: 8, fee: 450, bio: 'Clinical dermatology, acne protocols, allergy management and skin health.' },
      { name: 'Dr. Meera Iyer', phone: '+919876543213', email: 'dr.iyer@example.com', dept: 'Pediatrics', qualification: 'MBBS, DCH, MD (Pediatrics)', reg: 'APMC-2014-6182', exp: 15, fee: 500, bio: 'Child health, immunization schedules, growth milestones, and pediatric care.' },
      { name: 'Dr. Arvind Nair', phone: '+919876543214', email: 'dr.nair@example.com', dept: 'Orthopedics', qualification: 'MBBS, MS (Ortho), MCh Joint Arthroplasty', reg: 'KMC-2013-5211', exp: 14, fee: 650, bio: 'Joint replacement, fracture recovery, arthritis, and sports injury rehabilitation.' },
      { name: 'Dr. Kiran Reddy', phone: '+919876543215', email: 'dr.reddy@example.com', dept: 'Neurology', qualification: 'MBBS, DM (Neurology)', reg: 'TSMC-2015-3098', exp: 10, fee: 800, bio: 'Neurological disorders, migraines, nerve health, and comprehensive brain care.' },
      { name: 'Dr. Pooja Sen', phone: '+919876543216', email: 'dr.sen@example.com', dept: 'Gynecology', qualification: 'MBBS, MS (OBG), FICOG, Laparoscopy Fellow', reg: 'WBMC-2014-6102', exp: 14, fee: 650, bio: 'Women’s reproductive wellness, pregnancy care, PCOS, and maternal health.' },
      { name: 'Dr. Kavita Joshi', phone: '+919876543217', email: 'dr.joshi@example.com', dept: 'ENT', qualification: 'MS (ENT), DLO, Head & Neck Specialist', reg: 'MCI-2018-8812', exp: 7, fee: 600, bio: 'Ear, Nose & Throat clinical care, sinus management, and hearing diagnostics.' },
    ];

    for (const d of defaultDoctors) {
      const [existingDoctorUser] = await db.query('SELECT id FROM users WHERE phone = ?', [d.phone]);
      let docUserId;

      if (!existingDoctorUser.length) {
        const [uRes] = await db.query(
          'INSERT INTO users (firebase_uid, phone, email, role, status) VALUES (?, ?, ?, ?, ?)',
          ['doc_uid_' + d.phone.replace(/[^0-9]/g, ''), d.phone, d.email, ROLES.DOCTOR, USER_STATUS.ACTIVE]
        );
        docUserId = uRes.insertId;
      } else {
        docUserId = existingDoctorUser[0].id;
      }

      const [deptRows] = await db.query('SELECT id FROM departments WHERE name = ? LIMIT 1', [d.dept]);
      const deptId = deptRows.length ? deptRows[0].id : null;

      const [existingDoc] = await db.query('SELECT id FROM doctors WHERE user_id = ? OR phone = ?', [docUserId, d.phone]);
      let docId;

      if (!existingDoc.length) {
        const [docRes] = await db.query(
          `INSERT INTO doctors 
            (user_id, name, phone, email, department_id, registration_number, qualification, experience_years, bio, consultation_fee, verification_status, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            docUserId, d.name, d.phone, d.email, deptId, d.reg, d.qualification, d.exp, d.bio, d.fee,
            DOCTOR_VERIFICATION_STATUS.APPROVED, USER_STATUS.ACTIVE
          ]
        );
        docId = docRes.insertId;
      } else {
        docId = existingDoc[0].id;
        await db.query(
          `UPDATE doctors SET department_id = ?, verification_status = ?, status = ? WHERE id = ?`,
          [deptId, DOCTOR_VERIFICATION_STATUS.APPROVED, USER_STATUS.ACTIVE, docId]
        );
      }

      const [schedules] = await db.query('SELECT id FROM doctor_schedules WHERE doctor_id = ?', [docId]);
      if (!schedules.length) {
        for (let day = 1; day <= 6; day++) {
          await db.query(
            `INSERT INTO doctor_schedules 
              (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, status)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [docId, day, '09:00:00', '13:00:00', 30, 'ACTIVE']
          );
        }
      }
      console.log(`✅ Doctor ready: ${d.name} (${d.dept})`);
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
