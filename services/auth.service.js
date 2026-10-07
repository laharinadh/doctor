const admin = require('../config/firebase');
const db = require('../config/database');
const config = require('../config');
const { UnauthorizedError, ForbiddenError, BadRequestError } = require('../utils/errors');
const { USER_STATUS, ROLES, DOCTOR_VERIFICATION_STATUS } = require('../utils/constants');
const auditService = require('./audit.service');

class AuthService {
  async sendOtp(phone) {
    if (config.auth.mode === 'test') {
      return {
        message: 'OTP sent successfully (Test Mode: Use test verification)',
        phone,
        testMode: true,
      };
    }

    // In client-side Firebase Phone Auth, the client initiates the SMS OTP.
    // This backend endpoint acts as an acknowledgement / rate-limited gateway.
    return {
      message: 'Initiate Firebase Phone Auth SMS on the client side with this verified phone number',
      phone,
    };
  }

  async verifyOtpAndAuthenticate({ token, testPhone, role = ROLES.PATIENT, name = 'User', email = null, ip = null, userAgent = null }) {
    let firebaseUid;
    let verifiedPhone;

    if (config.auth.mode === 'test' && (!token || token === 'test-token')) {
      if (!testPhone) {
        throw new BadRequestError('Phone number is required in test mode');
      }
      verifiedPhone = testPhone;
      firebaseUid = `test_uid_${verifiedPhone.replace(/\+/g, '')}`;
    } else {
      if (!token) {
        throw new UnauthorizedError('Firebase ID token is required');
      }

      try {
        const decoded = await admin.auth().verifyIdToken(token);
        firebaseUid = decoded.uid;
        // Strictly extract phone from decoded Firebase token
        verifiedPhone = decoded.phone_number;

        if (!verifiedPhone) {
          throw new BadRequestError('Firebase token does not contain a verified phone number');
        }
      } catch (err) {
        throw new UnauthorizedError('Invalid or expired Firebase ID token');
      }
    }

    // Check if user exists
    const [existingUsers] = await db.query(
      'SELECT * FROM users WHERE firebase_uid = ? OR phone = ?',
      [firebaseUid, verifiedPhone]
    );

    if (existingUsers.length > 0) {
      const user = existingUsers[0];

      if (user.status === USER_STATUS.SUSPENDED) {
        throw new ForbiddenError('Account is suspended. Please contact support.');
      }

      // Fetch profile based on role
      let profile = null;
      if (user.role === ROLES.PATIENT) {
        const [patients] = await db.query('SELECT * FROM patients WHERE user_id = ?', [user.id]);
        profile = patients[0] || null;
      } else if (user.role === ROLES.DOCTOR) {
        const [doctors] = await db.query('SELECT * FROM doctors WHERE user_id = ?', [user.id]);
        profile = doctors[0] || null;
      }

      await auditService.log({
        userId: user.id,
        role: user.role,
        action: 'USER_LOGGED_IN',
        ip,
        userAgent,
      });

      return {
        user,
        profile,
        isNewUser: false,
      };
    }

    // Register new user inside a transaction
    const targetRole = role === ROLES.DOCTOR ? ROLES.DOCTOR : ROLES.PATIENT;

    return await db.withTransaction(async (conn) => {
      const [insertUser] = await conn.query(
        'INSERT INTO users (firebase_uid, phone, email, role, status) VALUES (?, ?, ?, ?, ?)',
        [firebaseUid, verifiedPhone, email || null, targetRole, USER_STATUS.ACTIVE]
      );
      const userId = insertUser.insertId;

      let profile = null;
      if (targetRole === ROLES.PATIENT) {
        const [insertPatient] = await conn.query(
          'INSERT INTO patients (user_id, name, phone, email) VALUES (?, ?, ?, ?)',
          [userId, name, verifiedPhone, email || null]
        );
        const [pRows] = await conn.query('SELECT * FROM patients WHERE id = ?', [insertPatient.insertId]);
        profile = pRows[0];
      } else if (targetRole === ROLES.DOCTOR) {
        const [insertDoctor] = await conn.query(
          'INSERT INTO doctors (user_id, name, phone, email, verification_status, status) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, name, verifiedPhone, email || null, DOCTOR_VERIFICATION_STATUS.PENDING, USER_STATUS.ACTIVE]
        );
        const [dRows] = await conn.query('SELECT * FROM doctors WHERE id = ?', [insertDoctor.insertId]);
        profile = dRows[0];
      }

      const [uRows] = await conn.query('SELECT * FROM users WHERE id = ?', [userId]);
      const newUser = uRows[0];

      await auditService.log({
        userId,
        role: targetRole,
        action: 'USER_REGISTERED',
        ip,
        userAgent,
      });

      return {
        user: newUser,
        profile,
        isNewUser: true,
      };
    });
  }

  async getCurrentUser(userId, role) {
    const [users] = await db.query('SELECT id, firebase_uid, phone, email, role, status, created_at FROM users WHERE id = ?', [userId]);
    if (!users.length) {
      throw new UnauthorizedError('User not found');
    }

    const user = users[0];
    let profile = null;

    if (role === ROLES.PATIENT) {
      const [patients] = await db.query('SELECT * FROM patients WHERE user_id = ?', [userId]);
      profile = patients[0] || null;
    } else if (role === ROLES.DOCTOR) {
      const [doctors] = await db.query('SELECT * FROM doctors WHERE user_id = ?', [userId]);
      profile = doctors[0] || null;
    }

    return { user, profile };
  }
}

module.exports = new AuthService();
