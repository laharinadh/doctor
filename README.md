# Doctor Consultation Platform — Backend

A production-grade, secure healthcare backend for a doctor-consultation platform built strictly with **Node.js + Express.js + JavaScript (ES6+) + MySQL** (no NestJS, no TypeScript, no ORM).

---

## Features

- **3 Roles**: `ADMIN`, `DOCTOR`, `PATIENT`.
- **Authentication**: Phone number **SMS OTP** via Firebase Authentication. The phone number is extracted exclusively from the cryptographically verified token (`decoded.phone_number`), never from the request body.
- **Doctor Discovery**: Search and filter verified doctors by department, experience, and fee.
- **Doctor Verification**: Doctors submit registration number, qualifications, and profile media for admin review and approval.
- **Dynamic Slot Engine**: Weekly recurring schedules with interval slots (e.g. 30 mins), doctor leaves, and real-time availability calculations.
- **Double-Booking Protection**: Transactional slot locking using MySQL `SELECT ... FOR UPDATE` with a 10-minute hold duration (`hold_expires_at`).
- **Platform Fee Payments**: Razorpay integration collecting ₹99/₹100 platform fee with secure HMAC-SHA256 webhook signature verification (`timingSafeEqual`). Doctor consultation fees are handled offline/directly.
- **Consultation Lifecycle**: Face-to-face, audio, and video (Google Meet / Zoom URLs) with clinical consultation notes.
- **Medical Records**: Private local filesystem storage (`storage/medical-records/`), strictly validated (PDF only, ≤ 100 KB, magic bytes verified), authenticated streamed downloads.
- **No Prescriptions**: Prescription and prescription items tables have been completely excluded.
- **Audit Logging**: Comprehensive, HIPAA/healthcare-compliant audit logging for sensitive actions without recording sensitive PHI/medical notes.
- **9-Layer Security Architecture**: Helmet, CORS, rate limiting, Joi validation with `stripUnknown`, parameterized queries, relationship-gated access control.

---

## Directory Structure

```text
├── config/                  # Configuration loaders (MySQL, Firebase, Razorpay, Redis)
├── database/                # Schema DDL (16 tables) and seeder
├── middleware/              # Auth, RBAC, Joi validate, RateLimit, Audit, Upload
├── routes/                  # API routes (/api/v1/...)
├── controllers/             # Request handlers
├── services/                # Business logic and SQL queries
├── validators/              # Joi request schemas
├── utils/                   # Errors, responses, helpers, constants, logger
├── storage/                 # Private local file storage (records, photos, videos)
├── logs/                    # Application error and combined logs
├── app.js                   # Express application setup
├── server.js                # Server bootstrap & graceful shutdown
└── PLAN.md                  # Comprehensive architectural plan
```

---

## Getting Started

### 1. Prerequisites
- **Node.js** (v20+ or v24+)
- **MySQL** (v8.0+)
- **Redis** (optional, fallback in-memory cache is active by default)

### 2. Environment Configuration
Copy `.env.example` to `.env` and adjust your database and credential values:
```bash
cp .env.example .env
```

### 3. Setup MySQL Database
Initialize the database and all 16 tables:
```bash
npm run db:init
```
*(Or manually in MySQL CLI: `mysql -u root -p < database/schema.sql`)*

### 4. Seed Admin & Initial Data
Run the seeder to populate default platform fee, medical departments, a root admin account, a sample verified doctor, and a sample patient:
```bash
npm run seed
```

### 5. Start the Server
Development mode with auto-reload:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

Base API URL: `http://localhost:3000/api/v1`

---

## Key API Endpoints

### Auth (`/api/v1/auth`)
| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/send-otp` | None | Trigger SMS OTP for phone number |
| `POST` | `/verify-otp` | Firebase Token / Test Mode | Verify OTP → Login or Register |
| `GET` | `/me` | Bearer Token | Get current user and profile |

### Patient (`/api/v1/patient`)
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/departments` | Patient | Browse active medical departments |
| `GET` | `/doctors` | Patient | Search approved doctors |
| `GET` | `/doctors/:id` | Patient | View doctor profile |
| `GET` | `/doctors/:id/slots?date=YYYY-MM-DD` | Patient | View available booking slots |
| `POST` | `/appointments` | Patient | Hold appointment slot (10-min lock) |
| `GET` | `/appointments` | Patient | List own appointments |
| `PATCH` | `/appointments/:id/cancel` | Patient | Cancel appointment |
| `POST` | `/medical-records` | Patient | Upload PDF record (≤ 100 KB) |
| `GET` | `/medical-records` | Patient | List uploaded records |
| `GET` | `/medical-records/:id/download` | Patient | Stream download PDF record |

### Payments (`/api/v1/payments`)
| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/create-order` | Patient | Create Razorpay order for held slot |
| `POST` | `/verify` | Patient | Verify Razorpay payment signature |
| `POST` | `/razorpay/webhook` | Webhook Sig | Razorpay server webhook |

### Doctor (`/api/v1/doctor`)
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/profile` | Doctor | View own doctor profile |
| `PATCH` | `/profile` | Doctor | Update profile |
| `POST` | `/verification` | Doctor | Submit verification documents |
| `GET` | `/verification` | Doctor | View verification status & history |
| `GET` | `/schedule` | Doctor | View weekly schedule |
| `POST` | `/schedule` | Doctor | Add/update weekly schedule |
| `POST` | `/leave` | Doctor | Apply for leave / time-off |
| `GET` | `/appointments` | Doctor | View assigned appointments |
| `PATCH` | `/appointments/:id` | Doctor | Update status (`IN_PROGRESS`, `COMPLETED`, etc.) |
| `PATCH` | `/consultations/:id` | Doctor | Add clinical consultation notes |
| `GET` | `/medical-records/:patientId` | Doctor | View patient records (relationship-gated) |

### Admin (`/api/v1/admin`)
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/dashboard` | Admin | System statistics & revenue |
| `GET` | `/doctors` | Admin | List all doctors (filterable) |
| `PATCH` | `/doctors/:id/verify` | Admin | Approve doctor |
| `PATCH` | `/doctors/:id/reject` | Admin | Reject doctor verification |
| `PATCH` | `/doctors/:id/suspend` | Admin | Suspend doctor account |
| `GET` | `/departments` | Admin | Manage departments |
| `GET` | `/settings` | Admin | View platform fee settings |
| `PATCH` | `/settings` | Admin | Update platform fee |
| `GET` | `/audit-logs` | Admin | View HIPAA audit logs |

---

## Testing & Verification
Run the verification check:
```bash
npm test
```
