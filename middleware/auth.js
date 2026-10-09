const admin = require('../config/firebase');
const db = require('../config/database');
const config = require('../config');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const { USER_STATUS } = require('../utils/constants');

async function authenticate(req, res, next) {
  try {
    const testAuthEnabled = config.auth.mode === 'test' || config.env === 'development';

    // Test identity injection is available only for an explicitly non-production test run.
    if (testAuthEnabled && req.headers['x-test-user-id']) {
      const testUserId = parseInt(req.headers['x-test-user-id'], 10);
      const [users] = await db.query('SELECT * FROM users WHERE id = ?', [testUserId]);

      if (!users.length) {
        return next(new UnauthorizedError('Test user not found'));
      }

      const user = users[0];
      if (user.status === USER_STATUS.SUSPENDED) {
        return next(new ForbiddenError('Account is suspended'));
      }

      req.user = user;
      await attachRoleProfile(req);
      return next();
    }

    // 2. Bearer token extraction
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new UnauthorizedError('Missing or malformed Authorization header'));
    }

    const token = authHeader.split(' ')[1];

    // Test tokens are never accepted by a production server.
    if (testAuthEnabled && token && token.startsWith('user-')) {
      const devUserId = parseInt(token.replace('user-', ''), 10);
      if (devUserId) {
        const [users] = await db.query('SELECT * FROM users WHERE id = ?', [devUserId]);
        if (users.length) {
          const user = users[0];
          if (user.status === USER_STATUS.SUSPENDED) {
            return next(new ForbiddenError('Account is suspended'));
          }
          req.user = user;
          await attachRoleProfile(req);
          return next();
        }
      }
    }
    let decoded;

    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch (err) {
      return next(new UnauthorizedError('Invalid or expired authentication token'));
    }

    const firebaseUid = decoded.uid;
    const [rows] = await db.query('SELECT * FROM users WHERE firebase_uid = ?', [firebaseUid]);

    if (!rows.length) {
      return next(new UnauthorizedError('User account not registered in database'));
    }

    const user = rows[0];
    if (user.status === USER_STATUS.SUSPENDED) {
      return next(new ForbiddenError('Account is suspended'));
    }

    req.user = user;
    req.decodedToken = decoded;
    await attachRoleProfile(req);

    next();
  } catch (error) {
    next(error);
  }
}

async function attachRoleProfile(req) {
  if (req.user.role === 'PATIENT') {
    const [patients] = await db.query('SELECT id, name FROM patients WHERE user_id = ?', [req.user.id]);
    if (patients.length > 0) {
      req.user.patientId = patients[0].id;
      req.user.patientName = patients[0].name;
    }
  } else if (req.user.role === 'DOCTOR') {
    const [doctors] = await db.query('SELECT id, name, verification_status FROM doctors WHERE user_id = ?', [req.user.id]);
    if (doctors.length > 0) {
      req.user.doctorId = doctors[0].id;
      req.user.doctorName = doctors[0].name;
      req.user.verificationStatus = doctors[0].verification_status;
    }
  }
}

module.exports = authenticate;
