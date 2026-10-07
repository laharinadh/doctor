# Doctor Consultation Backend — Implementation Plan

## Goal
Build the complete backend for a doctor-consultation platform using **plain Node.js + Express.js + JavaScript + MySQL** (no NestJS, no TypeScript, no ORM). The backend supports 3 roles (Admin, Doctor, Patient), appointment booking with Razorpay platform-fee payment (₹99/₹100), face-to-face/audio/video consultations, medical records, and audit logging. **No prescriptions.**

---

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Language | JavaScript (ES6+) |
| Database | MySQL via `mysql2` (connection pool, prepared statements) |
| Cache | Redis via `ioredis` |
| Auth | Firebase Admin SDK (ID token verification) |
| Payment | Razorpay Node.js SDK |
| File Upload | Multer |
| Validation | Joi |
| Security | Helmet, express-rate-limit, cors |
| Logging | Winston |
| Env | dotenv |
| UUID | uuid |

---

## User Review Required

> [!IMPORTANT]
> **No ORM** — all database queries are raw SQL with parameterized prepared statements via `mysql2`. This gives full control but means manual query writing for every operation.

> [!NOTE]
> **No Prescriptions** — The `prescriptions` and `prescription_items` tables are excluded per user requirement.

> [!IMPORTANT]
> **Firebase Admin SDK** requires a service account JSON file. You'll need to place it at `config/firebase-service-account.json` (gitignored). The plan assumes you already have a Firebase project.

> [!IMPORTANT]
> **Razorpay** requires `key_id` and `key_secret` in `.env`. The plan assumes you have a Razorpay account (test mode is fine for development).

> [!IMPORTANT]
> **Storage** — All files (doctor profile videos, doctor profile photos, and medical records) are stored on the **local filesystem** under `storage/` (private, never publicly served). Served only through authenticated backend download endpoints. This is abstracted in `services/storage.service.js` so it can be swapped to S3/GCS later without changing business logic.

---

## Open Questions

> [!IMPORTANT]
> **Redis** — Is Redis already installed locally, or should I add instructions for running without Redis initially (fallback to in-memory for dev)?

> [!IMPORTANT]
> **Admin seeding** — The first admin user needs to be seeded into the database. Plan assumes a `seed-admin.js` script that creates the admin user directly in MySQL.

---

## Complete File Listing (~63 files)

```
doctor-consultation-backend/
│
├── server.js                          # Express app bootstrap, middleware, route mounting
├── app.js                             # Express app factory (separated for testing)
├── package.json                       # Dependencies and scripts
├── .env.example                       # Environment variable template
├── .gitignore                         # Git ignore rules
│
├── config/
│   ├── database.js                    # MySQL connection pool (mysql2)
│   ├── firebase.js                    # Firebase Admin SDK init
│   ├── razorpay.js                    # Razorpay instance
│   ├── redis.js                       # Redis client (ioredis)
│   └── index.js                       # Central config loader from .env
│
├── database/
│   ├── schema.sql                     # Complete DDL (18 tables)
│   └── seed.js                        # Admin user + sample departments seeder
│
├── middleware/
│   ├── auth.js                        # Firebase ID token verification
│   ├── role.js                        # Role-based access control
│   ├── validate.js                    # Joi schema validation wrapper
│   ├── errorHandler.js                # Global error handler
│   ├── rateLimiter.js                 # Rate limiting config
│   └── audit.js                       # Audit log middleware
│
├── routes/
│   ├── index.js                       # Mount all route groups
│   ├── auth.routes.js                 # POST /login, /register
│   ├── admin.routes.js                # All /admin/* routes
│   ├── doctor.routes.js               # All /doctor/* routes
│   ├── patient.routes.js              # All /patient/* routes
│   ├── payment.routes.js              # Razorpay webhook
│   └── notification.routes.js         # Notification routes
│
├── controllers/
│   ├── auth.controller.js             # Login / register
│   ├── admin.controller.js            # Dashboard, doctor mgmt, settings, audit
│   ├── department.controller.js       # Department CRUD
│   ├── doctor.controller.js           # Doctor profile, verification submit
│   ├── patient.controller.js          # Patient profile, doctor search
│   ├── schedule.controller.js         # Schedule & leave CRUD
│   ├── appointment.controller.js      # Book, cancel, reschedule, status
│   ├── payment.controller.js          # Razorpay order, webhook, verify
│   ├── consultation.controller.js     # Start, complete, notes
│   ├── medical-record.controller.js   # Upload, list, download
│   └── notification.controller.js     # List, mark read
│
├── services/
│   ├── auth.service.js                # Firebase token verify, user create/find
│   ├── user.service.js                # User CRUD
│   ├── doctor.service.js              # Doctor profile, search, listing
│   ├── patient.service.js             # Patient profile CRUD
│   ├── department.service.js          # Department CRUD
│   ├── doctor-verification.service.js # Submit, review, approve/reject
│   ├── schedule.service.js            # Schedule CRUD, slot computation
│   ├── appointment.service.js         # Booking, hold, confirm, cancel, reschedule
│   ├── payment.service.js             # Razorpay order, verify, webhook
│   ├── consultation.service.js        # Consultation lifecycle
│   ├── medical-record.service.js      # Record metadata + file ops
│   ├── notification.service.js        # Create, list, mark read
│   ├── audit.service.js               # Audit log insert + query
│   ├── storage.service.js             # File save/read/delete (local fs)
│   └── platform-settings.service.js   # Platform fee config
│
├── validators/
│   ├── auth.validator.js              # Login/register schemas
│   ├── admin.validator.js             # Admin action schemas
│   ├── doctor.validator.js            # Doctor profile/verification schemas
│   ├── patient.validator.js           # Patient profile schemas
│   ├── department.validator.js        # Department schemas
│   ├── schedule.validator.js          # Schedule/leave schemas
│   └── appointment.validator.js       # Booking schemas
│
├── utils/
│   ├── response.js                    # success() / error() response helpers
│   ├── pagination.js                  # Paginated query helper
│   ├── errors.js                      # Custom error classes (AppError, NotFoundError, etc.)
│   ├── constants.js                   # Enums, status constants
│   └── helpers.js                     # UUID generator, date utils, appointment number gen
│
├── storage/                           # Private file storage (gitignored)
│   ├── medical-records/               # Patient PDFs (≤ 100KB)
│   ├── doctor-videos/                 # Doctor profile videos
│   └── doctor-photos/                 # Doctor profile photos
│
└── logs/                              # Application logs (gitignored)
```

---

## Complete MySQL Schema (16 tables)

```sql
-- ============================================================
-- 1. users
-- ============================================================
CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  firebase_uid  VARCHAR(128) NOT NULL,
  phone         VARCHAR(20)  NOT NULL,
  email         VARCHAR(255) NULL,
  role          ENUM('ADMIN','DOCTOR','PATIENT') NOT NULL,
  status        ENUM('ACTIVE','INACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_firebase_uid (firebase_uid),
  UNIQUE KEY uk_phone (phone),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 2. patients
-- ============================================================
CREATE TABLE patients (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  name        VARCHAR(255) NOT NULL,
  phone       VARCHAR(20)  NOT NULL,
  email       VARCHAR(255) NULL,
  height_cm   DECIMAL(5,1) NULL,
  weight_kg   DECIMAL(5,1) NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_id (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 3. departments
-- ============================================================
CREATE TABLE departments (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  description TEXT NULL,
  status      ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 4. doctors
-- ============================================================
CREATE TABLE doctors (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id               INT UNSIGNED NOT NULL,
  name                  VARCHAR(255) NOT NULL,
  phone                 VARCHAR(20)  NOT NULL,
  email                 VARCHAR(255) NULL,
  department_id         INT UNSIGNED NULL,
  registration_number   VARCHAR(100) NULL,
  qualification         VARCHAR(500) NULL,
  experience_years      INT UNSIGNED NULL,
  profile_video_url     VARCHAR(500) NULL,
  profile_photo_url     VARCHAR(500) NULL,
  bio                   TEXT NULL,
  consultation_fee      DECIMAL(10,2) NULL,
  verification_status   ENUM('PENDING','UNDER_REVIEW','APPROVED','REJECTED','SUSPENDED')
                        NOT NULL DEFAULT 'PENDING',
  status                ENUM('ACTIVE','INACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_id (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  INDEX idx_department (department_id),
  INDEX idx_verification (verification_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 5. doctor_verifications
-- ============================================================
CREATE TABLE doctor_verifications (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  doctor_id             INT UNSIGNED NOT NULL,
  registration_number   VARCHAR(100) NOT NULL,
  qualification         VARCHAR(500) NOT NULL,
  experience_years      INT UNSIGNED NOT NULL,
  profile_video_url     VARCHAR(500) NOT NULL,
  profile_photo_url     VARCHAR(500) NULL,
  verification_status   ENUM('PENDING','UNDER_REVIEW','APPROVED','REJECTED')
                        NOT NULL DEFAULT 'PENDING',
  rejection_reason      TEXT NULL,
  reviewed_by           INT UNSIGNED NULL,
  reviewed_at           TIMESTAMP NULL,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 6. doctor_schedules
-- ============================================================
CREATE TABLE doctor_schedules (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  doctor_id             INT UNSIGNED NOT NULL,
  day_of_week           TINYINT UNSIGNED NOT NULL COMMENT '0=Sun,1=Mon,...,6=Sat',
  start_time            TIME NOT NULL,
  end_time              TIME NOT NULL,
  slot_duration_minutes INT UNSIGNED NOT NULL DEFAULT 30,
  status                ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_doctor_day (doctor_id, day_of_week),
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 7. doctor_leaves
-- ============================================================
CREATE TABLE doctor_leaves (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  doctor_id       INT UNSIGNED NOT NULL,
  start_datetime  DATETIME NOT NULL,
  end_datetime    DATETIME NOT NULL,
  reason          VARCHAR(500) NULL,
  status          ENUM('ACTIVE','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
  INDEX idx_doctor (doctor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 8. appointments
-- ============================================================
CREATE TABLE appointments (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_number  VARCHAR(20) NOT NULL,
  patient_id          INT UNSIGNED NOT NULL,
  doctor_id           INT UNSIGNED NOT NULL,
  department_id       INT UNSIGNED NULL,
  appointment_date    DATE NOT NULL,
  start_time          TIME NOT NULL,
  end_time            TIME NOT NULL,
  consultation_mode   ENUM('FACE_TO_FACE','AUDIO','VIDEO') NOT NULL,
  status              ENUM('HELD','PAYMENT_PENDING','CONFIRMED','CANCELLED',
                           'NO_SHOW','WAITING','IN_PROGRESS','COMPLETED',
                           'RESCHEDULED') NOT NULL DEFAULT 'HELD',
  platform_fee        DECIMAL(10,2) NOT NULL,
  payment_id          INT UNSIGNED NULL,
  meeting_provider    ENUM('GOOGLE_MEET','ZOOM') NULL,
  meeting_url         VARCHAR(500) NULL,
  cancellation_reason TEXT NULL,
  hold_expires_at     DATETIME NULL,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_appointment_number (appointment_number),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  INDEX idx_doctor_date (doctor_id, appointment_date),
  INDEX idx_patient_date (patient_id, appointment_date),
  INDEX idx_status (status),
  INDEX idx_hold_expires (hold_expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 9. appointment_events (state machine audit trail)
-- ============================================================
CREATE TABLE appointment_events (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id  INT UNSIGNED NOT NULL,
  from_status     VARCHAR(50) NULL,
  to_status       VARCHAR(50) NOT NULL,
  changed_by      INT UNSIGNED NULL,
  reason          TEXT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 10. payments
-- ============================================================
CREATE TABLE payments (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id      INT UNSIGNED NOT NULL,
  patient_id          INT UNSIGNED NOT NULL,
  amount              DECIMAL(10,2) NOT NULL,
  currency            VARCHAR(10) NOT NULL DEFAULT 'INR',
  gateway             VARCHAR(50) NOT NULL DEFAULT 'RAZORPAY',
  gateway_order_id    VARCHAR(255) NULL,
  gateway_payment_id  VARCHAR(255) NULL,
  gateway_signature   VARCHAR(500) NULL,
  status              ENUM('CREATED','PENDING','SUCCESS','FAILED',
                           'REFUND_PENDING','REFUNDED') NOT NULL DEFAULT 'CREATED',
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  UNIQUE KEY uk_gateway_order (gateway_order_id),
  INDEX idx_gateway_payment (gateway_payment_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 11. refunds
-- ============================================================
CREATE TABLE refunds (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_id        INT UNSIGNED NOT NULL,
  amount            DECIMAL(10,2) NOT NULL,
  reason            TEXT NULL,
  gateway_refund_id VARCHAR(255) NULL,
  status            ENUM('PENDING','PROCESSED','FAILED') NOT NULL DEFAULT 'PENDING',
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 12. consultations
-- ============================================================
CREATE TABLE consultations (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id  INT UNSIGNED NOT NULL,
  patient_id      INT UNSIGNED NOT NULL,
  doctor_id       INT UNSIGNED NOT NULL,
  started_at      DATETIME NULL,
  ended_at        DATETIME NULL,
  status          ENUM('SCHEDULED','WAITING','ACTIVE','COMPLETED',
                       'INTERRUPTED','CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
  doctor_notes    TEXT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_appointment (appointment_id),
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 13. medical_records
-- ============================================================
CREATE TABLE medical_records (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id        INT UNSIGNED NOT NULL,
  uploaded_by       INT UNSIGNED NOT NULL,
  record_type       VARCHAR(100) NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type         VARCHAR(100) NOT NULL,
  file_size         INT UNSIGNED NOT NULL,
  storage_key       VARCHAR(500) NOT NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_patient (patient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- (prescriptions and prescription_items tables removed per requirement)

-- ============================================================
-- 14. notifications
-- ============================================================
CREATE TABLE notifications (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  type        VARCHAR(100) NOT NULL,
  title       VARCHAR(255) NOT NULL,
  body        TEXT NULL,
  channel     ENUM('SMS','EMAIL','PUSH','IN_APP') NOT NULL DEFAULT 'IN_APP',
  status      ENUM('PENDING','SENT','FAILED','READ') NOT NULL DEFAULT 'PENDING',
  read_at     DATETIME NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 15. platform_settings
-- ============================================================
CREATE TABLE platform_settings (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  platform_fee  DECIMAL(10,2) NOT NULL DEFAULT 99.00,
  currency      VARCHAR(10) NOT NULL DEFAULT 'INR',
  active        TINYINT(1) NOT NULL DEFAULT 1,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 16. audit_logs
-- ============================================================
CREATE TABLE audit_logs (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NULL,
  role          VARCHAR(50) NULL,
  action        VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NULL,
  resource_id   VARCHAR(100) NULL,
  ip_address    VARCHAR(45) NULL,
  user_agent    VARCHAR(500) NULL,
  metadata      JSON NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## API Endpoints (40+ routes)

### Auth (`/api/v1/auth`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/send-otp` | None | Send SMS OTP to phone number (via Firebase) |
| POST | `/verify-otp` | Firebase Token | Verify OTP → login or register (auto-detect) |
| GET | `/me` | Yes | Current user profile + role |

---

### Admin (`/api/v1/admin`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/dashboard` | ADMIN | Stats (counts, recent activity) |
| GET | `/doctors` | ADMIN | List all doctors (paginated, filterable) |
| GET | `/doctors/:id` | ADMIN | Doctor detail |
| PATCH | `/doctors/:id/verify` | ADMIN | Approve doctor |
| PATCH | `/doctors/:id/reject` | ADMIN | Reject doctor (with reason) |
| PATCH | `/doctors/:id/suspend` | ADMIN | Suspend doctor |
| GET | `/patients` | ADMIN | List patients (paginated) |
| GET | `/departments` | ADMIN | List departments |
| POST | `/departments` | ADMIN | Create department |
| PATCH | `/departments/:id` | ADMIN | Update department |
| DELETE | `/departments/:id` | ADMIN | Deactivate department |
| GET | `/appointments` | ADMIN | List all appointments |
| GET | `/payments` | ADMIN | List all payments |
| GET | `/settings` | ADMIN | Get platform settings |
| PATCH | `/settings` | ADMIN | Update platform fee |
| GET | `/audit-logs` | ADMIN | Paginated audit logs |

---

### Doctor (`/api/v1/doctor`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/profile` | DOCTOR | Get own profile |
| PATCH | `/profile` | DOCTOR | Update profile |
| POST | `/verification` | DOCTOR | Submit for verification |
| GET | `/verification` | DOCTOR | Get verification status |
| GET | `/schedule` | DOCTOR | Get own schedules |
| POST | `/schedule` | DOCTOR | Create/update schedule |
| DELETE | `/schedule/:id` | DOCTOR | Remove schedule |
| GET | `/leave` | DOCTOR | List leaves |
| POST | `/leave` | DOCTOR | Create leave |
| DELETE | `/leave/:id` | DOCTOR | Cancel leave |
| GET | `/appointments` | DOCTOR | Own appointments (filterable) |
| PATCH | `/appointments/:id` | DOCTOR | Update status (WAITING→IN_PROGRESS→COMPLETED) |
| GET | `/consultations` | DOCTOR | Own consultations |
| PATCH | `/consultations/:id` | DOCTOR | Update notes, complete |
| GET | `/patients` | DOCTOR | Patients with active relationship |
| GET | `/medical-records/:patientId` | DOCTOR | View patient records (authorized) |

---

### Patient (`/api/v1/patient`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/profile` | PATIENT | Get own profile |
| PATCH | `/profile` | PATIENT | Update profile |
| GET | `/departments` | PATIENT | Browse departments |
| GET | `/doctors` | PATIENT | Search/browse approved doctors |
| GET | `/doctors/:id` | PATIENT | Doctor detail + profile video |
| GET | `/doctors/:id/slots` | PATIENT | Available slots for a date |
| POST | `/appointments` | PATIENT | Book appointment (creates hold) |
| GET | `/appointments` | PATIENT | Own appointments |
| GET | `/appointments/:id` | PATIENT | Appointment detail |
| PATCH | `/appointments/:id/cancel` | PATIENT | Cancel appointment |
| GET | `/payments` | PATIENT | Payment history |
| POST | `/medical-records` | PATIENT | Upload record (PDF ≤ 100KB) |
| GET | `/medical-records` | PATIENT | List own records |
| GET | `/medical-records/:id/download` | PATIENT | Download own record |
| DELETE | `/medical-records/:id` | PATIENT | Delete own record |
| GET | `/consultations` | PATIENT | Own consultations |
| GET | `/notifications` | PATIENT | Own notifications |
| PATCH | `/notifications/:id/read` | PATIENT | Mark read |

---

### Payment (`/api/v1/payments`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/create-order` | PATIENT | Create Razorpay order for held appointment |
| POST | `/verify` | PATIENT | Verify payment signature client-side backup |
| POST | `/razorpay/webhook` | None (signature verified) | Razorpay server webhook |

---

## Key Implementation Patterns

### 1. Database Query Pattern (no ORM)

Every service uses the shared connection pool:

```js
// services/patient.service.js
const db = require('../config/database');

async function findById(patientId) {
  const [rows] = await db.query(
    'SELECT * FROM patients WHERE id = ?',
    [patientId]
  );
  return rows[0] || null;
}
```

### 2. Authentication Flow

```
Client                  Backend                      Firebase
  │                        │                            │
  │── Firebase ID Token ──►│                            │
  │                        │── admin.auth().verifyIdToken() ─►│
  │                        │◄── decoded token (uid, phone) ──│
  │                        │                            │
  │                        │── SELECT * FROM users      │
  │                        │   WHERE firebase_uid = ?   │
  │                        │                            │
  │◄── { user, token } ───│                            │
```

The `middleware/auth.js` extracts the `Authorization: Bearer <firebase_id_token>` header, verifies it with Firebase Admin SDK, and attaches `req.user` (the database user row).

### 3. Double-Booking Protection

```js
// Inside a MySQL transaction with SELECT ... FOR UPDATE
const conn = await db.getConnection();
try {
  await conn.beginTransaction();

  // Lock the slot — check for overlapping appointments
  const [existing] = await conn.query(
    `SELECT id FROM appointments
     WHERE doctor_id = ? AND appointment_date = ?
       AND start_time = ? AND status NOT IN ('CANCELLED','RESCHEDULED')
     FOR UPDATE`,
    [doctorId, date, startTime]
  );

  if (existing.length > 0) {
    await conn.rollback();
    throw new ConflictError('Slot already booked');
  }

  // Create HELD appointment
  const [result] = await conn.query(
    `INSERT INTO appointments (...) VALUES (...)`,
    [...]
  );

  await conn.commit();
  return result.insertId;
} catch (err) {
  await conn.rollback();
  throw err;
} finally {
  conn.release();
}
```

### 4. Slot Computation (no pre-generated rows)

```
Input: doctor_id, date
  │
  ├─ 1. Get schedule for that day_of_week
  │     → e.g. Monday: 10:00–13:00, 30min slots
  │
  ├─ 2. Generate all possible slots
  │     → [10:00, 10:30, 11:00, 11:30, 12:00, 12:30]
  │
  ├─ 3. Check doctor_leaves overlapping that date
  │     → Remove slots falling inside leave
  │
  ├─ 4. Check existing appointments (HELD/CONFIRMED/IN_PROGRESS)
  │     → Remove already-booked slots
  │
  └─ Output: available slots array
```

### 5. Payment Flow (Razorpay)

```js
// Step 1: Create order (backend)
const order = await razorpay.orders.create({
  amount: platformFee * 100,  // paise
  currency: 'INR',
  receipt: appointmentNumber,
});

// Step 2: Client pays via Razorpay checkout

// Step 3: Webhook (POST /api/v1/payments/razorpay/webhook)
// Verify signature:
const expectedSig = crypto
  .createHmac('sha256', RAZORPAY_KEY_SECRET)
  .update(webhookBody)
  .digest('hex');
if (expectedSig !== req.headers['x-razorpay-signature']) {
  throw new UnauthorizedError('Invalid webhook signature');
}
// Update payment → SUCCESS, appointment → CONFIRMED
```

### 6. File Upload Security

```
Upload request
  │
  ├─ 1. Auth middleware (valid token, correct role)
  ├─ 2. Multer: max 100KB, PDF only
  ├─ 3. Validate MIME type header
  ├─ 4. Validate magic bytes (PDF: %PDF-)
  ├─ 5. Generate storage key: medical-records/{patientId}/{uuid}.pdf
  ├─ 6. Save to private storage directory
  ├─ 7. Save metadata row to medical_records table
  └─ 8. Return record ID (not direct file path)
```

---

## Security Architecture

> [!CAUTION]
> This is a **healthcare application**. Security is not optional — it is a legal and ethical requirement. Every layer below is implemented from day one, not bolted on later.

### 1. Authentication — SMS OTP to Phone Number

The **only** way to authenticate is via **SMS OTP sent to the user's phone number** through Firebase Authentication. No passwords, no email login.

**Complete SMS OTP flow:**
```
Step 1: User enters phone number (+91XXXXXXXXXX)
        │
        ▼
Step 2: Client calls POST /api/v1/auth/send-otp
        │
        ▼
Step 3: Backend triggers Firebase to send SMS OTP
        │  firebase.admin.auth() → SMS to phone
        │
        ▼
Step 4: User receives SMS with 6-digit OTP
        │
        ▼
Step 5: User enters OTP in the app
        │
        ▼
Step 6: Client verifies OTP with Firebase (client-side SDK)
        │  firebase.auth().signInWithPhoneNumber()
        │  → Returns Firebase ID token
        │
        ▼
Step 7: Client sends Firebase ID token to backend
        │  POST /api/v1/auth/verify-otp
        │  Authorization: Bearer <firebase_id_token>
        │
        ▼
Step 8: Backend verifies token with Firebase Admin SDK
        │  admin.auth().verifyIdToken(token)
        │  → Extracts: uid, phone_number (verified by Firebase)
        │
        ▼
Step 9: Backend checks if user exists
        │
        ├── EXISTS → Login (return user + session)
        │
        └── NOT EXISTS → Register (create user, return user + session)
```

**Auth controller:**
```js
// POST /api/v1/auth/verify-otp
async function verifyOtp(req, res) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token' });

  // Verify with Firebase Admin SDK
  const decoded = await admin.auth().verifyIdToken(token);

  // Phone comes from Firebase (OTP-verified), NOT from request body
  const phone = decoded.phone_number;
  const firebaseUid = decoded.uid;

  if (!phone) return res.status(400).json({ success: false, message: 'Phone not verified' });

  // Check if user exists
  const [existing] = await db.query(
    'SELECT * FROM users WHERE firebase_uid = ?',
    [firebaseUid]
  );

  if (existing.length) {
    // LOGIN — existing user
    return res.json({ success: true, data: { user: existing[0], isNewUser: false } });
  }

  // REGISTER — new user (role provided in body: 'PATIENT' or 'DOCTOR')
  const role = req.body.role || 'PATIENT';
  const [result] = await db.query(
    'INSERT INTO users (firebase_uid, phone, role) VALUES (?, ?, ?)',
    [firebaseUid, phone, role]
  );

  const [newUser] = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
  return res.status(201).json({ success: true, data: { user: newUser[0], isNewUser: true } });
}
```

**Auth middleware for all protected routes (`middleware/auth.js`):**
```js
const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const token = header.split(' ')[1];

  try {
    // TEST MODE: skip Firebase in development
    if (process.env.AUTH_MODE === 'test') {
      // Use x-test-user-id header for dev/testing only
      // NEVER allow this in production
      // ...
    }

    const decoded = await admin.auth().verifyIdToken(token);
    const [rows] = await db.query(
      'SELECT * FROM users WHERE firebase_uid = ?',
      [decoded.uid]
    );

    if (!rows.length) return res.status(401).json({ success: false, message: 'User not found' });
    if (rows[0].status === 'SUSPENDED') return res.status(403).json({ success: false, message: 'Account suspended' });

    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};
```

> [!CAUTION]
> **The phone number is ONLY extracted from the Firebase-verified token (`decoded.phone_number`), NEVER from `req.body.phone`.** This guarantees the user actually owns that phone number (verified by SMS OTP).

---

### 2. Authorization — Three Layers

```
Layer 1: RBAC (Role-Based Access Control)
  │  "Only ADMIN can access /api/v1/admin/*"
  │  "Only DOCTOR can access /api/v1/doctor/*"
  │  "Only PATIENT can access /api/v1/patient/*"
  │
Layer 2: Object-Level Authorization
  │  "Doctor can only see their OWN appointments"
  │  "Patient can only see their OWN records"
  │
Layer 3: Resource Ownership / Relationship Check
     "Doctor can only view patient records IF they have
      an active appointment/consultation relationship"
```

**Implementation in `middleware/role.js`:**
```js
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    next();
  };
};

// Usage in routes:
router.get('/dashboard', authenticate, authorize('ADMIN'), adminController.dashboard);
```

**Object-level checks in services:**
```js
// Doctor can only update THEIR OWN consultation
async function updateConsultation(consultationId, doctorId, data) {
  const [rows] = await db.query(
    'SELECT * FROM consultations WHERE id = ? AND doctor_id = ?',
    [consultationId, doctorId]  // ← ownership check
  );
  if (!rows.length) throw new ForbiddenError('Not your consultation');
  // ...
}
```

**Relationship gate for doctor → patient records:**
```js
// Doctor can only view patient records if relationship exists
async function canDoctorAccessPatient(doctorId, patientId) {
  const [rows] = await db.query(
    `SELECT 1 FROM appointments
     WHERE doctor_id = ? AND patient_id = ?
       AND status IN ('CONFIRMED','IN_PROGRESS','COMPLETED')
     LIMIT 1`,
    [doctorId, patientId]
  );
  return rows.length > 0;
}
```

---

### 3. Input Validation & Injection Prevention

| Threat | Defence |
|--------|---------|
| **SQL Injection** | All queries use `?` parameterized placeholders via `mysql2`. No string concatenation. |
| **XSS** | Helmet sets `X-Content-Type-Options: nosniff`, `X-XSS-Protection`. Input sanitized. No HTML rendering. |
| **NoSQL Injection** | N/A (no NoSQL). |
| **Mass Assignment** | Joi schemas whitelist allowed fields. Only validated fields reach the service layer. |
| **Type Coercion** | Joi enforces types — `Joi.number().integer()`, `Joi.string().trim()`, etc. |

**Validation middleware pattern:**
```js
// middleware/validate.js
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,    // ← removes unexpected fields
      convert: true
    });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(d => d.message)
      });
    }
    req.body = value;  // ← use sanitized data only
    next();
  };
};
```

> [!CAUTION]
> **Never concatenate user input into SQL strings.** Always use `?` placeholders.
> ```js
> // ❌ DANGEROUS
> db.query(`SELECT * FROM users WHERE phone = '${req.body.phone}'`);
>
> // ✅ SAFE
> db.query('SELECT * FROM users WHERE phone = ?', [req.body.phone]);
> ```

---

### 4. File Upload Security

Every uploaded file is treated as **untrusted and potentially malicious**.

```
Upload request
  │
  ├─ 1. Authentication (valid Firebase token)
  ├─ 2. Authorization (correct role + ownership)
  ├─ 3. Multer limits:
  │      Medical records: max 100 KB, PDF only
  │      Doctor videos:   max 50 MB, MP4/WebM only
  │      Doctor photos:   max 5 MB, JPEG/PNG only
  │
  ├─ 4. MIME type validation (Content-Type header)
  ├─ 5. Magic byte validation:
  │      PDF:  %PDF- (0x25 0x50 0x44 0x46 0x2D)
  │      JPEG: FF D8 FF
  │      PNG:  89 50 4E 47
  │      MP4:  00 00 00 xx 66 74 79 70
  │
  ├─ 6. Generate storage key (NEVER use user filename):
  │      medical-records/{patientId}/{uuid}.pdf
  │      doctor-videos/{doctorId}/{uuid}.mp4
  │      doctor-photos/{doctorId}/{uuid}.jpg
  │
  ├─ 7. Save to PRIVATE storage/ directory
  │      (never inside public/ or static/)
  │
  ├─ 8. Save metadata to database
  │      (storage_key, mime_type, file_size, original_filename)
  │
  └─ 9. Return record ID only (never the file path)
```

**File download is always authenticated:**
```js
// GET /api/v1/patient/medical-records/:id/download
router.get('/:id/download', authenticate, authorize('PATIENT'), async (req, res) => {
  const record = await medicalRecordService.findById(req.params.id);

  // Ownership check
  if (record.patient_id !== req.user.patientId) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const filePath = storageService.getAbsolutePath(record.storage_key);
  res.setHeader('Content-Type', record.mime_type);
  res.setHeader('Content-Disposition', `attachment; filename="${record.original_filename}"`);
  fs.createReadStream(filePath).pipe(res);
});
```

---

### 5. Medical Data Access Control

```
┌─────────────────────────────────────────────────────┐
│                   Access Matrix                      │
├────────────┬──────────┬──────────┬──────────────────┤
│ Resource   │ Patient  │ Doctor   │ Admin            │
├────────────┼──────────┼──────────┼──────────────────┤
│ Own profile│ RW       │ RW       │ R (all)          │
│ Med record │ RW (own) │ R (auth) │ ✗ (no access)    │
│ Consult    │ R (own)  │ RW (own) │ R (metadata)     │
│ Appointment│ R (own)  │ R (own)  │ R (all)          │
│ Payment    │ R (own)  │ ✗        │ R (all)          │
│ Audit logs │ ✗        │ ✗        │ R (all)          │
└────────────┴──────────┴──────────┴──────────────────┘

R = Read, W = Write, auth = relationship-gated
```

**Key rules enforced in every service method:**
- Patient A **cannot** see Patient B's records — `WHERE patient_id = ?`
- Doctor **cannot** view a patient's records without an active appointment
- Admin **cannot** download medical record files (metadata only)
- IDs from the URL/body are **never trusted** — always cross-checked against `req.user`

---

### 6. API Security Hardening

```js
// server.js — applied globally
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// Security headers (CSP, HSTS, X-Frame-Options, etc.)
app.use(helmet());

// CORS — restrict to your frontend origins
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Global rate limit: 100 requests per 15 minutes per IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests' }
}));

// Stricter limits on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,                    // ← only 10 login attempts
  message: { success: false, message: 'Too many login attempts' }
});
app.use('/api/v1/auth', authLimiter);

// Stricter limits on payment endpoints
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many payment requests' }
});
app.use('/api/v1/payments', paymentLimiter);

// Disable X-Powered-By header
app.disable('x-powered-by');

// Limit request body size
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
```

---

### 7. Payment Security (Razorpay)

```
┌──────────────────────────────────────────────────────┐
│  NEVER trust frontend saying "payment successful"    │
│  ONLY trust Razorpay server-side webhook signature   │
└──────────────────────────────────────────────────────┘
```

**Webhook signature verification:**
```js
const crypto = require('crypto');

function verifyWebhookSignature(body, signature, secret) {
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(body))
    .digest('hex');

  // Timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(expectedSig),
    Buffer.from(signature)
  );
}
```

**Payment rules enforced in code:**
- Platform fee amount is **read from `platform_settings` table** on each order — never from frontend
- Razorpay order amount is set by backend — client cannot modify it
- Payment status transitions: CREATED → PENDING → SUCCESS/FAILED (backend only)
- Appointment moves to CONFIRMED **only** after webhook confirms SUCCESS
- Idempotency: duplicate webhooks for same `gateway_payment_id` are safely ignored

---

### 8. Audit Logging

Every sensitive action is logged to `audit_logs` — this is a **healthcare requirement**.

```js
// services/audit.service.js
async function log({ userId, role, action, resourceType, resourceId, ip, userAgent, metadata }) {
  await db.query(
    `INSERT INTO audit_logs
       (user_id, role, action, resource_type, resource_id, ip_address, user_agent, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, role, action, resourceType, resourceId, ip, userAgent,
     metadata ? JSON.stringify(metadata) : null]
  );
}
```

**Audited actions:**
```
ADMIN_LOGIN
ADMIN_UPDATED_SETTINGS
DOCTOR_APPROVED
DOCTOR_REJECTED
DOCTOR_SUSPENDED
PATIENT_RECORD_UPLOADED
PATIENT_RECORD_VIEWED
PATIENT_RECORD_DOWNLOADED
PATIENT_RECORD_DELETED
APPOINTMENT_CREATED
APPOINTMENT_CANCELLED
APPOINTMENT_RESCHEDULED
PAYMENT_ORDER_CREATED
PAYMENT_VERIFIED
CONSULTATION_STARTED
CONSULTATION_COMPLETED
```

> [!CAUTION]
> **Never log medical content** (doctor notes, record contents, patient health data) into application logs or audit metadata. Log only IDs, actions, and who/when/where.

---

### 9. Infrastructure Security

| Concern | Implementation |
|---------|---------------|
| **HTTPS/TLS** | Nginx terminates TLS. Backend runs on localhost only. |
| **Secrets** | All secrets in `.env` — never committed to git. `.env` is in `.gitignore`. |
| **Private storage** | `storage/` directory is outside the web root. Never served by Nginx directly. |
| **Database** | MySQL user has minimum required privileges. Connection uses connection pool with limits. |
| **Redis** | Password-protected. Not exposed to public network. |
| **Dependencies** | `npm audit` run regularly. No `eval()`, no `Function()` constructors. |
| **Error responses** | Production error handler **never** leaks stack traces, SQL errors, or internal paths. |
| **Logging** | Winston writes to `logs/` — no medical content, no tokens, no passwords. |

**Production error handler:**
```js
// middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  // Log full error internally
  logger.error(err.message, { stack: err.stack, path: req.path });

  // Return safe response to client
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? 'Internal server error' : err.message
    // ← NO stack trace, NO SQL error, NO file paths
  });
};
```

---

## Build Phases

### Phase 1 — Foundation
- `package.json`, `.env.example`, `.gitignore`
- `config/` — database, firebase, razorpay, redis
- `database/schema.sql`
- `utils/` — response, pagination, errors, constants, helpers
- `middleware/` — errorHandler, rateLimiter, audit
- `server.js` + `app.js`

### Phase 2 — Auth & Users
- `middleware/auth.js`, `middleware/role.js`, `middleware/validate.js`
- `services/auth.service.js`, `services/user.service.js`
- `controllers/auth.controller.js`
- `validators/auth.validator.js`
- `routes/auth.routes.js`
- `database/seed.js` (admin seeder)

### Phase 3 — Admin & Departments
- `services/department.service.js`, `services/audit.service.js`, `services/platform-settings.service.js`
- `services/doctor-verification.service.js`
- `controllers/admin.controller.js`, `controllers/department.controller.js`
- `validators/admin.validator.js`, `validators/department.validator.js`
- `routes/admin.routes.js`

### Phase 4 — Doctor Profile & Verification
- `services/doctor.service.js`
- `controllers/doctor.controller.js`
- `validators/doctor.validator.js`
- Doctor verification submit flow

### Phase 5 — Scheduling
- `services/schedule.service.js` (schedule CRUD + slot computation)
- `controllers/schedule.controller.js`
- `validators/schedule.validator.js`
- `routes/doctor.routes.js` (schedule/leave endpoints)

### Phase 6 — Patient, Booking & Payment
- `services/patient.service.js`, `services/appointment.service.js`, `services/payment.service.js`
- `controllers/patient.controller.js`, `controllers/appointment.controller.js`, `controllers/payment.controller.js`
- `validators/patient.validator.js`, `validators/appointment.validator.js`
- `routes/patient.routes.js`, `routes/payment.routes.js`
- Double-booking protection + appointment hold + Razorpay integration

### Phase 7 — Consultations, Prescriptions & Medical Records
- `services/consultation.service.js`, `services/medical-record.service.js`
- `services/storage.service.js`
- `controllers/consultation.controller.js`, `controllers/medical-record.controller.js`

### Phase 8 — Notifications & Polish
- `services/notification.service.js`
- `controllers/notification.controller.js`
- `routes/notification.routes.js`
- `routes/index.js` (mount all routes)
- Final security hardening (helmet, CORS, rate limiting)

---

## Verification Plan

### Automated
```bash
# 1. Install dependencies
npm install

# 2. Create database and run schema
mysql -u root -p < database/schema.sql

# 3. Seed admin user
node database/seed.js

# 4. Start server
npm run dev

# 5. Verify server starts without errors
# Expected: "Server running on port 3000" + "MySQL connected" + "Redis connected"
```

### Manual Verification (via curl/Postman)
1. **Auth** — Register patient with Firebase token → verify user created in DB
2. **Admin** — Login as admin → create department → list departments
3. **Doctor** — Register doctor → submit verification → admin approves → doctor becomes bookable
4. **Schedule** — Doctor creates schedule → patient sees available slots
5. **Booking** — Patient books slot → HELD → Razorpay order created → webhook confirms → CONFIRMED
6. **Medical Records** — Upload PDF → verify stored in `storage/` → download via authenticated endpoint
7. **Consultation** — Doctor starts consultation → adds notes → completes
8. **Double-booking** — Two concurrent bookings for same slot → only one succeeds

> [!TIP]
> For local dev without Firebase, the auth middleware can be configured to accept a test mode via `AUTH_MODE=test` env var that skips Firebase verification and uses a mock user.
