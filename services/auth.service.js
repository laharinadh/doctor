const crypto = require('crypto');
const admin = require('../config/firebase');
const db = require('../config/database');
const config = require('../config');
const { UnauthorizedError, ForbiddenError, BadRequestError } = require('../utils/errors');
const { USER_STATUS, ROLES, DOCTOR_VERIFICATION_STATUS } = require('../utils/constants');
const auditService = require('./audit.service');
const smsService = require('./sms.service');

// In-memory real-time OTP store (phone -> { otp, expiresAt, attempts })
const otpStore = new Map();
const MAX_OTP_ATTEMPTS = 5;

class AuthService {
  async sendOtp(phone) {
    if (!phone) {
      throw new BadRequestError('Phone number is required');
    }

    // Format phone to standard E.164
    let cleanPhone = phone.trim().replace(/[\s-]/g, '');
    if (!cleanPhone.startsWith('+')) {
      cleanPhone = cleanPhone.length === 10 ? '+91' + cleanPhone : '+' + cleanPhone;
    }

    // Generate random 6-digit real-time OTP
    const generatedOtp = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes TTL

    // Store in active OTP cache
    const record = { otp: generatedOtp, expiresAt, attempts: 0 };
    otpStore.set(cleanPhone, record);
    setTimeout(() => {
      if (otpStore.get(cleanPhone) === record) otpStore.delete(cleanPhone);
    }, 5 * 60 * 1000 + 1000).unref?.();

    // Dispatch real-time SMS
    await smsService.sendSms({
      phone: cleanPhone,
      otp: generatedOtp,
      message: `Your Careflow verification code is ${generatedOtp}. Valid for 5 minutes.`,
    });

    return {
      message: `OTP sent successfully to ${cleanPhone}.`,
      phone: cleanPhone,
      expiresInSeconds: 300,
    };
  }

  async verifyOtpAndAuthenticate({ token, testPhone, role = ROLES.PATIENT, name = 'User', email = null, ip = null, userAgent = null }) {
    let firebaseUid;
    let verifiedPhone;
    let sessionToken = null;

    // Normalize phone
    if (testPhone) {
      verifiedPhone = testPhone.trim().replace(/[\s-]/g, '');
      if (!verifiedPhone.startsWith('+')) {
        verifiedPhone = verifiedPhone.length === 10 ? '+91' + verifiedPhone : '+' + verifiedPhone;
      }
    }

    const inputCode = String(token || '').trim();
    const storedRecord = verifiedPhone ? otpStore.get(verifiedPhone) : null;
    const testAuthEnabled = config.auth.mode === 'test' && config.env !== 'production';
    const isStoredOtpValid = storedRecord && storedRecord.otp === inputCode && Date.now() <= storedRecord.expiresAt && storedRecord.attempts < MAX_OTP_ATTEMPTS;
    const isMasterDevCode = testAuthEnabled && inputCode === '123456';
    const isTestMode = testAuthEnabled && (!token || inputCode === 'test-token');

    if (storedRecord && !isStoredOtpValid && !isMasterDevCode && !isTestMode) {
      storedRecord.attempts += 1;
      if (storedRecord.attempts >= MAX_OTP_ATTEMPTS || Date.now() > storedRecord.expiresAt) {
        otpStore.delete(verifiedPhone);
      }
    }

    if (isStoredOtpValid || isMasterDevCode || isTestMode) {
      if (!verifiedPhone) {
        throw new BadRequestError('Phone number is required in verification');
      }
      // If stored OTP was used, consume it (single-use token protection)
      if (storedRecord) {
        otpStore.delete(verifiedPhone);
      }
      firebaseUid = `uid_${verifiedPhone.replace(/\+/g, '')}`;
    } else {
      // If not matching in-memory real-time OTP or dev code, verify Firebase ID token
      const isFirebaseReady = admin.apps && admin.apps.length > 0;
      if (!isFirebaseReady || !token || token.length <= 6) {
        throw new BadRequestError('Invalid or expired OTP. Please enter the latest 6-digit code sent to your phone.');
      }

      try {
        const decoded = await admin.auth().verifyIdToken(token);
        firebaseUid = decoded.uid;
        const tokenPhone = decoded.phone_number;

        if (verifiedPhone && tokenPhone && verifiedPhone !== tokenPhone) {
          throw new BadRequestError('Phone number does not match the verified Firebase account');
        }
        verifiedPhone = tokenPhone;

        if (!verifiedPhone) {
          throw new BadRequestError('Firebase token does not contain a verified phone number');
        }
        sessionToken = token;
      } catch (err) {
        throw new UnauthorizedError('Invalid or expired Firebase ID token');
      }
    }

    // Check if user exists
    const [existingUsers] = await db.query(
      sessionToken
        ? 'SELECT * FROM users WHERE firebase_uid = ? OR phone = ?'
        : 'SELECT * FROM users WHERE phone = ?',
      sessionToken ? [firebaseUid, verifiedPhone] : [verifiedPhone]
    );

    if (existingUsers.length > 0) {
      const user = existingUsers[0];

      if (user.status === USER_STATUS.SUSPENDED) {
        throw new ForbiddenError('Account is suspended. Please contact support.');
      }

      // Sync firebase_uid if updated or missing
      if (firebaseUid && (!user.firebase_uid || user.firebase_uid !== firebaseUid)) {
        await db.query('UPDATE users SET firebase_uid = ? WHERE id = ?', [firebaseUid, user.id]);
        user.firebase_uid = firebaseUid;
      }

      // Fetch profile based on role (auto-provision if missing)
      let profile = null;
      if (user.role === ROLES.PATIENT) {
        let [patients] = await db.query('SELECT * FROM patients WHERE user_id = ?', [user.id]);
        if (patients.length === 0) {
          const [ins] = await db.query(
            'INSERT INTO patients (user_id, name, phone, email) VALUES (?, ?, ?, ?)',
            [user.id, name || 'Patient', verifiedPhone, email || null]
          );
          [patients] = await db.query('SELECT * FROM patients WHERE id = ?', [ins.insertId]);
        }
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
        token: sessionToken,
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
        token: sessionToken,
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
