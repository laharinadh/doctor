# Doctor Consultation Backend — Implementation Plan & Architecture Specification

## 1. Overview & Scope

A production-grade, secure healthcare backend for a doctor-consultation platform built strictly with **Node.js + Express.js + JavaScript (ES6+) + MySQL** (no NestJS, no TypeScript, no ORM).

### Core Capabilities:
- **3 Roles**: `ADMIN`, `DOCTOR`, `PATIENT`.
- **Authentication**: Strictly **SMS OTP to phone number** via Firebase Authentication. Phone number is extracted exclusively from the cryptographically verified token (`decoded.phone_number`), never from the request body.
- **Doctor Discovery & Profiles**: Filterable search by department, experience, rating, etc.
- **Doctor Verification Workflow**: Registration, qualifications, identity, profile photos & videos submission; Admin review & approval/rejection.
- **Scheduling & Dynamic Slots**: Weekly recurring doctor schedules, doctor leaves/time-off, dynamic slot computation avoiding pre-generated slot bloat.
- **Appointment Booking**: Two-phase booking with concurrency-safe slot locking (`SELECT ... FOR UPDATE`), 10-minute hold duration, and state-machine transitions.
- **Platform Fee Payments**: Razorpay integration collecting ₹99/₹100 platform fee with secure server-side webhook signature verification (HMAC-SHA256, timing-safe comparison). Doctor consultation fees are handled directly/offline.
- **Consultation Lifecycle**: Face-to-Face, Audio, and Video (Google Meet / Zoom URL integration); status tracking and doctor consultation notes.
- **Medical Records**: Private local storage (`storage/medical-records/`), strictly validated (PDF only, ≤ 100 KB, magic bytes verified), authenticated streamed downloads.
- **No Prescriptions**: Prescription and prescription items tables have been completely excluded.
- **Private Storage**: Local filesystem storage (`storage/`) for profile media and records, completely private, never served statically by the web server.
- **Audit Logging**: Comprehensive, HIPAA/healthcare-compliant audit logging for sensitive actions without recording sensitive PHI/medical notes.
- **Security Hardening**: 9-layer security architecture (Helmet, CORS, rate limiting, Joi validation with `stripUnknown`, parameterized queries, relationship-gated access control).

---

## 2. Technology Stack

| Component | Choice | Details |
|---|---|---|
| **Runtime** | Node.js | v20+ / v24+ |
| **Framework** | Express.js | v4.x |
| **Language** | JavaScript | Clean modern ES6+ (CommonJS modules) |
| **Database** | MySQL | Connected via `mysql2/promise` (connection pooling, parameterized queries) |
| **Cache & Hold Expiry** | Redis | Optional / resilient fallback for caching & holds via `ioredis` |
| **Authentication** | Firebase Admin SDK | ID Token verification with fallback `AUTH_MODE=test` for dev |
| **Payments** | Razorpay SDK | Orders API + HMAC webhook signature verification |
| **File Uploads** | Multer | Memory/disk stream with magic byte & size limits |
| **Validation** | Joi | Strict schema whitelisting, stripping unknown properties |
| **Security Headers** | Helmet | CSP, HSTS, X-Frame-Options, Hide X-Powered-By |
| **Rate Limiting** | express-rate-limit | Global + tighter limits on auth & payment endpoints |
| **CORS** | cors | Configured with allowed origins from `.env` |
| **Logging** | Winston | Rotating structured logs in `logs/` |
| **Environment** | dotenv | `.env` configuration loader |
| **Unique Identifiers** | uuid | UUIDv4 for file storage keys and transaction references |

---

## 3. Security Architecture (9 Defense Layers)

1. **Authentication (SMS OTP Only)**:
   - User inputs phone number.
   - Client triggers Firebase SMS OTP.
   - User enters OTP, receives Firebase ID token.
   - Client sends Bearer token to backend `/api/v1/auth/verify-otp`.
   - Backend verifies token via Firebase Admin SDK.
   - Verified phone (`decoded.phone_number`) is extracted from token.
   - Automatic account discovery: existing user logs in, new user registers with chosen role.
   - `AUTH_MODE=test` available strictly for offline local testing using `x-test-user-id`.

2. **Authorization (Three-Tier RBAC & Ownership)**:
   - Layer 1: Route-level RBAC (`ADMIN`, `DOCTOR`, `PATIENT`).
   - Layer 2: Object-level ownership check (`doctor_id === req.user.doctorId` or `patient_id === req.user.patientId`).
   - Layer 3: Relationship gating: A doctor can ONLY access patient medical records if an active appointment or consultation exists between them.

3. **Input Validation & Injection Prevention**:
   - Zero SQL concatenation: 100% prepared statements via `mysql2` parameterized `?` placeholders.
   - Joi validation on all incoming payload bodies, query params, and route params.
   - `stripUnknown: true` to prevent mass-assignment attacks.

4. **File Security & Private Storage**:
   - Files stored in local private directory `storage/`, outside web server docroot.
   - Maximum size: Medical records ≤ 100 KB; Profile photos ≤ 5 MB; Videos ≤ 50 MB.
   - MIME type and magic byte verification (e.g., `%PDF-` check).
   - Random UUID storage keys instead of original client filenames.
   - Served exclusively through authenticated, role-checked streaming endpoints.

5. **Medical Data Privacy**:
   - Patients can only view/download their own records.
   - Admins can view record metadata (filename, date, size) but CANNOT view/download patient medical documents.
   - Doctors can only view records of patients with confirmed/in-progress/completed appointments.

6. **API Hardening**:
   - Helmet protection enabled.
   - Disabled `x-powered-by`.
   - Request body size capped at 1MB.
   - Rate limiting: General 100 req/15min, Auth 10 req/15min, Payment 20 req/15min.

7. **Payment Integrity**:
   - Platform fee retrieved strictly from `platform_settings` table (never trusted from frontend).
   - Razorpay webhook verified using `crypto.timingSafeEqual` with HMAC-SHA256 signature.
   - Idempotency guard against duplicate webhook events.

8. **Audit Logging**:
   - Actions logged to `audit_logs` table (Logins, verifications, status changes, uploads, bookings, payments, downloads).
   - Healthcare compliance: No sensitive clinical content, doctor notes, or passwords in audit logs.

9. **Error Handling & Infrastructure**:
   - Centralized error handler masks internal SQL error messages and stack traces in production.
   - Graceful shutdown for database pool and Redis connection.

---

## 4. Complete Database Schema (16 Tables)

```sql
-- 1. users
CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  firebase_uid VARCHAR(128) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255) NULL,
  role ENUM('ADMIN','DOCTOR','PATIENT') NOT NULL,
  status ENUM('ACTIVE','INACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_firebase_uid (firebase_uid),
  UNIQUE KEY uk_phone (phone),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. patients
CREATE TABLE patients (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255) NULL,
  height_cm DECIMAL(5,1) NULL,
  weight_kg DECIMAL(5,1) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_id (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. departments
CREATE TABLE departments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. doctors
CREATE TABLE doctors (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255) NULL,
  department_id INT UNSIGNED NULL,
  registration_number VARCHAR(100) NULL,
  qualification VARCHAR(500) NULL,
  experience_years INT UNSIGNED NULL,
  profile_video_url VARCHAR(500) NULL,
  profile_photo_url VARCHAR(500) NULL,
  bio TEXT NULL,
  consultation_fee DECIMAL(10,2) NULL,
  verification_status ENUM('PENDING','UNDER_REVIEW','APPROVED','REJECTED','SUSPENDED') NOT NULL DEFAULT 'PENDING',
  status ENUM('ACTIVE','INACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_id (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  INDEX idx_department (department_id),
  INDEX idx_verification (verification_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. doctor_verifications
CREATE TABLE doctor_verifications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT UNSIGNED NOT NULL,
  registration_number VARCHAR(100) NOT NULL,
  qualification VARCHAR(500) NOT NULL,
  experience_years INT UNSIGNED NOT NULL,
  profile_video_url VARCHAR(500) NOT NULL,
  profile_photo_url VARCHAR(500) NULL,
  verification_status ENUM('PENDING','UNDER_REVIEW','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  rejection_reason TEXT NULL,
  reviewed_by INT UNSIGNED NULL,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. doctor_schedules
CREATE TABLE doctor_schedules (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT UNSIGNED NOT NULL,
  day_of_week TINYINT UNSIGNED NOT NULL COMMENT '0=Sun,1=Mon,...,6=Sat',
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_duration_minutes INT UNSIGNED NOT NULL DEFAULT 30,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_doctor_day (doctor_id, day_of_week),
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. doctor_leaves
CREATE TABLE doctor_leaves (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT UNSIGNED NOT NULL,
  start_datetime DATETIME NOT NULL,
  end_datetime DATETIME NOT NULL,
  reason VARCHAR(500) NULL,
  status ENUM('ACTIVE','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
  INDEX idx_doctor (doctor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. appointments
CREATE TABLE appointments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_number VARCHAR(20) NOT NULL,
  patient_id INT UNSIGNED NOT NULL,
  doctor_id INT UNSIGNED NOT NULL,
  department_id INT UNSIGNED NULL,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  consultation_mode ENUM('FACE_TO_FACE','AUDIO','VIDEO') NOT NULL,
  status ENUM('HELD','PAYMENT_PENDING','CONFIRMED','CANCELLED','NO_SHOW','WAITING','IN_PROGRESS','COMPLETED','RESCHEDULED') NOT NULL DEFAULT 'HELD',
  platform_fee DECIMAL(10,2) NOT NULL,
  payment_id INT UNSIGNED NULL,
  meeting_provider ENUM('GOOGLE_MEET','ZOOM') NULL,
  meeting_url VARCHAR(500) NULL,
  cancellation_reason TEXT NULL,
  hold_expires_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_appointment_number (appointment_number),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  INDEX idx_doctor_date (doctor_id, appointment_date),
  INDEX idx_patient_date (patient_id, appointment_date),
  INDEX idx_status (status),
  INDEX idx_hold_expires (hold_expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. appointment_events
CREATE TABLE appointment_events (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT UNSIGNED NOT NULL,
  from_status VARCHAR(50) NULL,
  to_status VARCHAR(50) NOT NULL,
  changed_by INT UNSIGNED NULL,
  reason TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. payments
CREATE TABLE payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT UNSIGNED NOT NULL,
  patient_id INT UNSIGNED NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  gateway VARCHAR(50) NOT NULL DEFAULT 'RAZORPAY',
  gateway_order_id VARCHAR(255) NULL,
  gateway_payment_id VARCHAR(255) NULL,
  gateway_signature VARCHAR(500) NULL,
  status ENUM('CREATED','PENDING','SUCCESS','FAILED','REFUND_PENDING','REFUNDED') NOT NULL DEFAULT 'CREATED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  UNIQUE KEY uk_gateway_order (gateway_order_id),
  INDEX idx_gateway_payment (gateway_payment_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. refunds
CREATE TABLE refunds (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_id INT UNSIGNED NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT NULL,
  gateway_refund_id VARCHAR(255) NULL,
  status ENUM('PENDING','PROCESSED','FAILED') NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. consultations
CREATE TABLE consultations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT UNSIGNED NOT NULL,
  patient_id INT UNSIGNED NOT NULL,
  doctor_id INT UNSIGNED NOT NULL,
  started_at DATETIME NULL,
  ended_at DATETIME NULL,
  status ENUM('SCHEDULED','WAITING','ACTIVE','COMPLETED','INTERRUPTED','CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
  doctor_notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_appointment (appointment_id),
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. medical_records
CREATE TABLE medical_records (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id INT UNSIGNED NOT NULL,
  uploaded_by INT UNSIGNED NOT NULL,
  record_type VARCHAR(100) NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INT UNSIGNED NOT NULL,
  storage_key VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_patient (patient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 14. notifications
CREATE TABLE notifications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NULL,
  channel ENUM('SMS','EMAIL','PUSH','IN_APP') NOT NULL DEFAULT 'IN_APP',
  status ENUM('PENDING','SENT','FAILED','READ') NOT NULL DEFAULT 'PENDING',
  read_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 15. platform_settings
CREATE TABLE platform_settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  platform_fee DECIMAL(10,2) NOT NULL DEFAULT 99.00,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  active TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 16. audit_logs
CREATE TABLE audit_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  role VARCHAR(50) NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NULL,
  resource_id VARCHAR(100) NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(500) NULL,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 5. Directory Structure

```text
doctor-consultation-backend/
├── server.js                          # Express app bootstrap, HTTP server listener
├── app.js                             # Express application setup, middlewares, routes
├── package.json                       # Project manifest & dependencies
├── .env.example                       # Environment variables template
├── .gitignore                         # Git exclusion rules
│
├── config/
│   ├── index.js                       # Central env configuration
│   ├── database.js                    # MySQL2 pool configuration
│   ├── firebase.js                    # Firebase Admin SDK initialization
│   ├── razorpay.js                    # Razorpay instance wrapper
│   └── redis.js                       # Redis client wrapper with fallback
│
├── database/
│   ├── schema.sql                     # Full SQL DDL (16 tables)
│   └── seed.js                        # Admin user & departments seeder
│
├── middleware/
│   ├── auth.js                        # Bearer token verification & user attachment
│   ├── role.js                        # RBAC role checking
│   ├── validate.js                    # Joi validation middleware wrapper
│   ├── errorHandler.js                # Central error handler
│   ├── rateLimiter.js                 # API rate limiters
│   └── audit.js                       # Audit logging helper middleware
│
├── routes/
│   ├── index.js                       # API route aggregator (/api/v1)
│   ├── auth.routes.js                 # Authentication routes
│   ├── admin.routes.js                # Admin management routes
│   ├── doctor.routes.js               # Doctor operations & schedules
│   ├── patient.routes.js              # Patient discovery, bookings & records
│   ├── payment.routes.js              # Razorpay order & webhook
│   └── notification.routes.js         # In-app notifications
│
├── controllers/
│   ├── auth.controller.js             # SMS OTP verify & session handler
│   ├── admin.controller.js            # Admin metrics, verifications, settings
│   ├── department.controller.js       # Department management
│   ├── doctor.controller.js           # Profile & verification submission
│   ├── schedule.controller.js         # Working schedules & leaves
│   ├── patient.controller.js          # Patient profile & browsing
│   ├── appointment.controller.js      # Booking, hold & status transition
│   ├── payment.controller.js          # Orders & webhook handling
│   ├── consultation.controller.js     # Consultation session & notes
│   ├── medical-record.controller.js   # PDF upload & download
│   └── notification.controller.js     # Notification operations
│
├── services/
│   ├── auth.service.js                # User identity verification & sync
│   ├── user.service.js                # User retrieval & status
│   ├── admin.service.js               # Admin analytics & metrics
│   ├── doctor.service.js              # Doctor profiles & queries
│   ├── doctor-verification.service.js # Verification workflow
│   ├── department.service.js          # Department queries
│   ├── schedule.service.js            # Schedule operations & dynamic slot engine
│   ├── patient.service.js             # Patient operations
│   ├── appointment.service.js         # Transactional booking & state machine
│   ├── payment.service.js             # Razorpay order creation & HMAC check
│   ├── consultation.service.js        # Consultation lifecycle
│   ├── medical-record.service.js      # Record metadata management
│   ├── storage.service.js             # Secure local filesystem storage engine
│   ├── notification.service.js        # Notification dispatch & reading
│   ├── audit.service.js               # Audit logging service
│   └── platform-settings.service.js   # Platform fee configuration
│
├── validators/
│   ├── auth.validator.js              # Auth payload schemas
│   ├── admin.validator.js             # Admin action schemas
│   ├── department.validator.js        # Department schemas
│   ├── doctor.validator.js            # Doctor schemas
│   ├── schedule.validator.js          # Schedule & leave schemas
│   ├── patient.validator.js           # Patient schemas
│   └── appointment.validator.js       # Booking & payment schemas
│
├── utils/
│   ├── response.js                    # Standard JSON response helpers
│   ├── pagination.js                  # SQL pagination utility
│   ├── errors.js                      # Custom HTTP Error classes
│   ├── constants.js                   # Application enums & constants
│   └── helpers.js                     # Appointment number generator, date helpers
│
├── storage/                           # Private local directory (gitignored)
│   ├── medical-records/               # Patient PDF records
│   ├── doctor-videos/                 # Doctor presentation videos
│   └── doctor-photos/                 # Doctor profile pictures
│
└── logs/                              # Log files (gitignored)
```

---

## 6. Execution & Build Steps

1. **Phase 1: Foundation**
   - Setup project manifest `package.json`, environment configurations `.env.example`, `.gitignore`.
   - Setup configuration singletons: MySQL (`config/database.js`), Redis (`config/redis.js`), Firebase (`config/firebase.js`), Razorpay (`config/razorpay.js`), Central config (`config/index.js`).
   - Setup DDL schema `database/schema.sql`.
   - Setup shared utilities (`utils/errors.js`, `utils/response.js`, `utils/constants.js`, `utils/helpers.js`, `utils/pagination.js`).
   - Setup core middlewares (`middleware/errorHandler.js`, `middleware/rateLimiter.js`, `middleware/validate.js`).
   - Setup base application: `app.js` and `server.js`.

2. **Phase 2: Authentication & User Management**
   - Implement `middleware/auth.js` supporting Firebase ID Token validation and local test mode (`AUTH_MODE=test`).
   - Implement `middleware/role.js` with role-based checks.
   - Implement `services/auth.service.js`, `services/user.service.js`.
   - Implement `validators/auth.validator.js`, `controllers/auth.controller.js`, `routes/auth.routes.js`.
   - Implement database seeder `database/seed.js` for initial Admin account and default departments.

3. **Phase 3: Administration, Departments & Platform Settings**
   - Implement `services/platform-settings.service.js`, `services/audit.service.js`, `services/department.service.js`.
   - Implement `services/doctor-verification.service.js`.
   - Implement `controllers/admin.controller.js`, `controllers/department.controller.js`.
   - Implement `validators/admin.validator.js`, `validators/department.validator.js`.
   - Implement `routes/admin.routes.js`.

4. **Phase 4: Doctor Profiles & Verification**
   - Implement `services/doctor.service.js` with filtering, search, and profile updates.
   - Implement `validators/doctor.validator.js`, `controllers/doctor.controller.js`.
   - Implement doctor verification request submission.

5. **Phase 5: Scheduling & Dynamic Slot Engine**
   - Implement `services/schedule.service.js` with dynamic slot calculation:
     - Pull weekly recurring schedule for requested day of week.
     - Divide into slot durations (e.g., 30 mins).
     - Filter out past times for today.
     - Filter out doctor active leaves/time off.
     - Filter out existing active appointments (`HELD`, `CONFIRMED`, `IN_PROGRESS`).
   - Implement `validators/schedule.validator.js`, `controllers/schedule.controller.js`.
   - Wire schedule and leave routes into `routes/doctor.routes.js`.

6. **Phase 6: Patient Flow, Concurrency-Safe Booking & Payments**
   - Implement `services/patient.service.js`.
   - Implement `services/appointment.service.js`:
     - MySQL transaction with `SELECT ... FOR UPDATE` to prevent double-booking.
     - Creation of appointment in `HELD` state with 10-minute expiry (`hold_expires_at`).
     - Appointment number generation (`APT-YYYYMMDD-XXXX`).
   - Implement `services/payment.service.js`:
     - Razorpay order creation tied to appointment.
     - Webhook signature validation via HMAC-SHA256 (`crypto.timingSafeEqual`).
     - Safe status transition from `HELD` to `CONFIRMED`.
   - Implement `controllers/patient.controller.js`, `controllers/appointment.controller.js`, `controllers/payment.controller.js`.
   - Implement `routes/patient.routes.js`, `routes/payment.routes.js`.

7. **Phase 7: Consultations, Storage Engine & Medical Records**
   - Implement `services/storage.service.js`:
     - Local filesystem storage handling inside `storage/`.
     - Stream handling and file deletion.
   - Implement `services/medical-record.service.js`:
     - Multer configuration checking PDF MIME type & magic bytes (`%PDF-`).
     - File size capped at 100 KB.
     - Relationship verification before doctor access.
   - Implement `services/consultation.service.js`:
     - Status updates (`WAITING`, `ACTIVE`, `COMPLETED`).
     - Doctor clinical notes saving.
   - Implement controllers and routes for medical records and consultations.

8. **Phase 8: Notifications, Route Aggregation & System Verification**
   - Implement `services/notification.service.js`, `controllers/notification.controller.js`, `routes/notification.routes.js`.
   - Assemble all routes in `routes/index.js` and mount on `app.js`.
   - Install all npm packages and verify system startup and test scripts.
