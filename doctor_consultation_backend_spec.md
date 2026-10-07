# Doctor Consultation Application — Backend Technical Specification

## 1. Product Scope

A secure doctor-consultation platform with three roles:

- **Admin**
- **Doctor**
- **Patient**

The application supports:

- Doctor discovery and profiles
- Doctor verification
- Doctor scheduling
- Appointment booking
- Face-to-face consultation
- Audio consultation
- Video consultation through Google Meet or Zoom
- Platform-fee payment through Razorpay
- Medical-record upload
- Prescriptions
- Secure medical-data access
- Notifications
- Audit logging

The application **does not include in-app chat**.

The application collects **only the platform fee (₹99 or ₹100)**. The doctor's consultation fee is paid directly to the doctor and is outside the application's payment flow.

---

# 2. Technology Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + NestJS + TypeScript |
| Database | MySQL |
| Cache / scaling | Redis |
| Authentication | Firebase Authentication |
| Phone verification | Firebase OTP |
| Payment | Razorpay |
| File storage | Private Object Storage |
| API | REST / HTTPS |
| Video consultation | Google Meet / Zoom |
| Audio consultation | External/phone audio integration |
| Deployment | Linux server / cloud |
| Reverse proxy | Nginx |
| Architecture | Modular monolith initially |

---

# 3. High-Level Architecture

```text
Patient Web/App
Doctor Web/App
Admin Web
       |
       | HTTPS
       v
+-----------------------+
| Load Balancer / Nginx |
+-----------+-----------+
            |
            v
+-----------------------+
| Node.js / NestJS API  |
| Modular Monolith      |
+----+---------+--------+
     |         |
     |         +--------------------+
     |                              |
     v                              v
+---------+                     +---------+
|  MySQL  |                     |  Redis  |
+---------+                     +---------+
     |
     +------------------------+
     |                        |
     v                        v
Private Object Storage     Audit / Data
     |
     +-----------------------------+
     |                             |
     v                             v
Medical Records              Doctor Videos

External Services:
- Firebase Authentication
- Razorpay
- Google Meet / Zoom
- Audio-call provider
- Email/SMS/Push notification provider
```

---

# 4. Core Business Rules

| Requirement | Rule |
|---|---|
| Patient name | Mandatory |
| Patient phone | Mandatory |
| Phone verification | Firebase OTP |
| Patient email | Optional |
| Height | Optional |
| Weight | Optional |
| Medical record | Optional |
| Original medical file | Maximum 100 KB before conversion |
| Final medical PDF | Maximum 100 KB |
| Doctor name | Mandatory |
| Doctor phone | Mandatory + OTP verified |
| Doctor department | Mandatory |
| Medical registration number | Mandatory |
| Qualification | Mandatory |
| Experience | Mandatory |
| Doctor profile video | Mandatory |
| Doctor profile photo | Recommended |
| Case studies | Recommended |
| Doctor schedule | Mandatory |
| Face-to-face consultation | Supported |
| Audio consultation | Supported |
| Video consultation | Supported |
| Video provider | Google Meet / Zoom |
| In-app chat | Not supported |
| Consultation fee | Paid directly to doctor |
| Platform fee | ₹99 or ₹100 |
| Platform payment | Razorpay |
| Medical data security | Mandatory |
| Audit logging | Mandatory |

---

# 5. Patient Registration

## Required Information

```text
Name *
Phone *
```

## Optional Information

```text
Email
Height
Weight
Medical records
```

## Firebase OTP Workflow

```text
Patient enters phone number
        |
        v
Firebase sends OTP
        |
        v
Patient enters OTP
        |
        v
Firebase verifies OTP
        |
        v
Backend verifies Firebase ID token
        |
        v
Create/update patient
        |
        v
Patient account ACTIVE
```

The backend must not trust a phone number supplied by the client without verifying the Firebase authentication identity.

---

# 6. Patient Database

## users

```sql
users
--------------------------------
id
firebase_uid
phone
email
role
status
created_at
updated_at
```

## patients

```sql
patients
--------------------------------
id
user_id
name
phone
email
height_cm
weight_kg
created_at
updated_at
```

---

# 7. Medical Record Upload

The medical-record conversion happens locally on the user's device.

## Required Workflow

```text
Original file <= 100 KB
        |
        v
Local conversion
        |
        v
Compress PDF
        |
        v
PDF <= 100 KB ?
       /        \
     YES         NO
      |           |
      v           v
   Upload      Ask user to
               reduce quality /
               choose another file
```

## Example

```text
JPG: 80 KB
   |
   v
Convert locally
   |
   v
PDF: 130 KB
   |
   v
Compress
   |
   v
PDF: 95 KB
   |
   v
Upload
```

If a readable PDF cannot be produced within 100 KB, the application must ask the user to reduce quality or choose another file.

## Backend Validation

The backend must still validate:

- MIME type
- File signature / magic bytes
- File size
- PDF validity
- Authentication
- Authorization
- Malicious content
- Storage path
- Ownership

Do not trust only the file extension.

---

# 8. Medical Record Storage

Medical files should not be stored directly as BLOBs in MySQL.

Use:

```text
MySQL
  |
  +-- Medical record metadata

Private Object Storage
  |
  +-- Actual PDF
```

## medical_records

```sql
medical_records
--------------------------------
id
patient_id
uploaded_by
record_type
original_filename
mime_type
file_size
storage_key
created_at
updated_at
```

Example:

```text
storage_key:
medical-records/patient-382/record-9821.pdf
```

Object storage must be private. Files should be accessed through authenticated, short-lived signed URLs or a protected backend download endpoint.

---

# 9. Doctor Profile

## Mandatory Information

```text
Doctor Name *
Phone *
Firebase OTP verification *
Department *
Medical Registration Number *
Qualification *
Experience *
Profile Video *
Doctor Schedule *
```

## Recommended Information

```text
Profile Photo
Case Studies
Additional Certifications
Professional Biography
Hospital / Clinic Information
```

---

# 10. Doctor Verification Workflow

```text
Doctor Registration
        |
        v
Name + Phone
        |
        v
Firebase OTP Verification
        |
        v
Department
Medical Registration Number
Qualification
Experience
        |
        v
Upload Mandatory Profile Video
        |
        v
Submit for Verification
        |
        v
ADMIN REVIEW
       / \
      /   \
APPROVED  REJECTED
   |
   v
Doctor becomes BOOKABLE
```

A doctor must not be bookable before successful admin verification.

## Verification Status

```text
PENDING
UNDER_REVIEW
APPROVED
REJECTED
SUSPENDED
```

## doctor_verifications

```sql
doctor_verifications
--------------------------------
id
doctor_id
registration_number
qualification
experience_years
profile_video_url
profile_photo_url
verification_status
rejection_reason
reviewed_by
reviewed_at
created_at
updated_at
```

---

# 11. doctors Table

```sql
doctors
--------------------------------
id
user_id
name
phone
email
department_id
registration_number
qualification
experience_years
profile_video_url
profile_photo_url
verification_status
status
created_at
updated_at
```

---

# 12. Departments

## departments

```sql
departments
--------------------------------
id
name
description
status
created_at
updated_at
```

Examples:

```text
General Medicine
Cardiology
Dermatology
Orthopedics
Pediatrics
Neurology
Gynecology
ENT
Ophthalmology
```

Departments should be configurable by Admin.

---

# 13. Doctor Scheduling

Doctors define their available recurring times.

Example:

```text
Monday
10:00 AM - 1:00 PM

Tuesday
4:00 PM - 8:00 PM

Wednesday
10:00 AM - 1:00 PM

Thursday
OFF

Friday
4:00 PM - 8:00 PM
```

## doctor_schedules

```sql
doctor_schedules
--------------------------------
id
doctor_id
day_of_week
start_time
end_time
slot_duration_minutes
status
created_at
updated_at
```

## Doctor Leave / Exception

```sql
doctor_leaves
--------------------------------
id
doctor_id
start_datetime
end_datetime
reason
status
created_at
updated_at
```

Availability should be calculated from:

```text
Doctor schedule
      +
Doctor leave
      +
Existing appointments
      =
Available slots
```

Do not create an unlimited number of future appointment rows unnecessarily.

---

# 14. Appointment Types

## Face-to-Face

```text
Patient
   |
   v
Book appointment
   |
   v
Pay platform fee
   |
   v
Appointment confirmed
   |
   v
Patient visits doctor
```

## Audio

```text
Patient
   |
   v
Book appointment
   |
   v
Pay platform fee
   |
   v
Appointment confirmed
   |
   v
Audio consultation
```

## Video

```text
Patient
   |
   v
Book appointment
   |
   v
Pay platform fee
   |
   v
Appointment confirmed
   |
   v
Google Meet / Zoom
```

---

# 15. appointments Table

```sql
appointments
--------------------------------
id
appointment_number
patient_id
doctor_id
department_id
appointment_date
start_time
end_time
consultation_mode
status
platform_fee
payment_id
meeting_provider
meeting_url
created_at
updated_at
```

## consultation_mode

```text
FACE_TO_FACE
AUDIO
VIDEO
```

## meeting_provider

```text
GOOGLE_MEET
ZOOM
NULL
```

Face-to-face appointments do not require a meeting URL.

---

# 16. Appointment State Machine

```text
AVAILABLE
    |
    v
HELD
    |
    v
PAYMENT_PENDING
    |
    v
CONFIRMED
    |
    +----> CANCELLED
    |
    +----> NO_SHOW
    |
    v
WAITING
    |
    v
IN_PROGRESS
    |
    v
COMPLETED
```

For rescheduling:

```text
CONFIRMED
    |
    v
RESCHEDULED
    |
    v
New appointment
```

Appointment status changes must be controlled by the backend.

---

# 17. Double-Booking Protection

The backend must prevent two patients from booking the same doctor slot.

Do not rely only on:

```text
if (slotAvailable) {
   book();
}
```

Use MySQL transactions and locking/appropriate constraints.

The booking operation should be atomic:

```text
Check slot
   |
   v
Lock relevant appointment data
   |
   v
Create appointment hold
   |
   v
Create Razorpay order
   |
   v
Payment verification
   |
   v
Confirm appointment
```

If payment expires or fails, release the appointment hold.

---

# 18. Platform Payment

The application collects only:

```text
Platform Fee
₹99 OR ₹100
```

The consultation fee is outside the application.

Example:

```text
Doctor consultation fee: ₹500
Platform fee: ₹99

Patient pays ₹99 through the application.

₹500 consultation fee is handled directly
between patient and doctor.
```

The application should not process the ₹500 as a platform payment.

---

# 19. Platform Fee Configuration

Do not hard-code the platform fee throughout the application.

## platform_settings

```sql
platform_settings
--------------------------------
id
platform_fee
currency
active
updated_at
```

Example:

```text
platform_fee = 99
currency = INR
active = true
```

The value can later be changed to:

```text
platform_fee = 100
```

without changing application code.

---

# 20. Razorpay Payment Workflow

```text
Patient selects appointment
        |
        v
Backend validates doctor/slot
        |
        v
Appointment HOLD
        |
        v
Backend calculates platform fee
        |
        v
Create Razorpay order
        |
        v
Patient pays
        |
        v
Razorpay webhook
        |
        v
Backend verifies payment
        |
        v
Payment SUCCESS
        |
        v
Appointment CONFIRMED
```

Never trust only a frontend message saying:

```text
Payment successful
```

Razorpay's server-side verification/webhook must be authoritative.

---

# 21. payments Table

```sql
payments
--------------------------------
id
appointment_id
patient_id
amount
currency
gateway
gateway_order_id
gateway_payment_id
status
created_at
updated_at
```

Possible statuses:

```text
CREATED
PENDING
SUCCESS
FAILED
REFUND_PENDING
REFUNDED
```

There is no doctor consultation amount in this payment table.

---

# 22. Consultation

## consultations

```sql
consultations
--------------------------------
id
appointment_id
patient_id
doctor_id
started_at
ended_at
status
doctor_notes
created_at
updated_at
```

Statuses:

```text
SCHEDULED
WAITING
ACTIVE
COMPLETED
INTERRUPTED
CANCELLED
```

---

# 23. Video Consultation

The Node.js backend should not transport video traffic.

Use:

```text
Patient
   |
   +----------------------+
   |                      |
   v                      v
NestJS API           Google Meet / Zoom
   |
Authentication
Authorization
Appointment validation
Meeting/session information
```

The backend controls who can access the meeting.

For example:

```text
Appointment ID
       |
       v
Is patient assigned to appointment?
       |
       v
Is doctor assigned to appointment?
       |
       v
Is appointment active/within allowed window?
       |
       v
Allow meeting access
```

---

# 24. Doctor Profile Video vs Consultation Video

These are different.

## Doctor Profile Video

```text
Doctor
  |
  v
Upload profile video
  |
  v
Admin verification
  |
  v
Approved
  |
  v
Displayed on doctor profile
```

## Consultation Video

```text
Patient + Doctor
       |
       v
Specific appointment
       |
       v
Google Meet / Zoom
```

They must use separate storage/access policies.

---

# 25. No Chat

The application intentionally does not include:

```text
Chat rooms
Message history
WebSocket chat
Patient-doctor messaging
Chat attachments
```

This reduces:

- Infrastructure complexity
- Data-storage requirements
- Abuse/moderation requirements
- Privacy risks
- Notification complexity

The primary communication channels are:

```text
Face-to-face
Audio
Video
```

---

# 26. Prescriptions

## prescriptions

```sql
prescriptions
--------------------------------
id
consultation_id
patient_id
doctor_id
status
issued_at
created_at
updated_at
```

## prescription_items

```sql
prescription_items
--------------------------------
id
prescription_id
medicine_name
dosage
frequency
duration
instructions
```

Only authorized doctors should be able to create prescriptions for their own consultations.

---

# 27. Notifications

## notifications

```sql
notifications
--------------------------------
id
user_id
type
title
body
channel
status
read_at
created_at
```

Potential notifications:

```text
OTP / authentication
Appointment confirmation
Appointment reminder
Appointment cancellation
Doctor verification result
Payment confirmation
Consultation reminder
Prescription available
Follow-up reminder
```

---

# 28. Audit Logging

Because this is a healthcare application, important actions should be auditable.

## audit_logs

```sql
audit_logs
--------------------------------
id
user_id
role
action
resource_type
resource_id
ip_address
user_agent
metadata
created_at
```

Examples:

```text
DOCTOR_APPROVED
DOCTOR_REJECTED
PATIENT_RECORD_VIEWED
PATIENT_RECORD_DOWNLOADED
PRESCRIPTION_CREATED
APPOINTMENT_CANCELLED
PAYMENT_VERIFIED
ADMIN_LOGIN
ADMIN_UPDATED_SETTINGS
```

Do not put sensitive medical content into ordinary logs.

---

# 29. Security Requirements

Security is mandatory.

## Authentication

- Firebase Authentication
- Phone OTP
- Secure Firebase ID-token verification
- Short-lived application sessions/tokens where appropriate
- Refresh-token rotation if application sessions use refresh tokens

## Authorization

Use:

```text
RBAC
+
Object-Level Authorization
+
Resource Ownership Checks
```

Roles:

```text
ADMIN
DOCTOR
PATIENT
```

---

# 30. Medical Record Access Control

A patient must only access their own records.

Example:

```text
Patient A
   |
   +--> Record A --> ALLOW
   |
   +--> Record B --> DENY
```

A doctor should only access patient information when authorized by the relevant appointment/consultation relationship.

Never trust:

```text
patient_id
doctor_id
record_id
```

sent by the frontend without server-side authorization checks.

---

# 31. Data Security

Implement:

- HTTPS/TLS everywhere
- Secure HTTP headers
- Input validation
- SQL parameterization / ORM protections
- Rate limiting
- Brute-force protection
- Firebase authentication
- Role-based authorization
- Object-level authorization
- Secure file validation
- Malware scanning
- Private object storage
- Encryption at rest where supported
- Database backups
- Disaster recovery
- Secrets outside source code
- No passwords/tokens in logs
- No medical content in application logs
- Audit logging
- Admin MFA
- Secure CORS configuration
- Dependency vulnerability scanning
- Security monitoring

---

# 32. File Security

Uploaded files must be treated as untrusted.

Validation:

```text
Authentication
    |
    v
Authorization
    |
    v
File size
    |
    v
MIME type
    |
    v
Magic bytes
    |
    v
PDF validation
    |
    v
Malware scanning
    |
    v
Private storage
```

Use generated storage keys rather than directly trusting user filenames.

---

# 33. Admin APIs

```text
/api/v1/admin/dashboard

/api/v1/admin/doctors
/api/v1/admin/doctors/:id
/api/v1/admin/doctors/:id/verify
/api/v1/admin/doctors/:id/reject
/api/v1/admin/doctors/:id/suspend

/api/v1/admin/patients

/api/v1/admin/departments

/api/v1/admin/appointments

/api/v1/admin/payments

/api/v1/admin/settings

/api/v1/admin/audit-logs
```

---

# 34. Doctor APIs

```text
/api/v1/doctor/profile

/api/v1/doctor/verification

/api/v1/doctor/schedule
/api/v1/doctor/leave

/api/v1/doctor/appointments
/api/v1/doctor/appointments/:id

/api/v1/doctor/patients

/api/v1/doctor/consultations
/api/v1/doctor/consultations/:id

/api/v1/doctor/prescriptions

/api/v1/doctor/medical-records
```

---

# 35. Patient APIs

```text
/api/v1/patient/profile

/api/v1/patient/departments
/api/v1/patient/doctors
/api/v1/patient/doctors/:id

/api/v1/patient/appointments
/api/v1/patient/appointments/:id

/api/v1/patient/payments

/api/v1/patient/medical-records

/api/v1/patient/consultations

/api/v1/patient/prescriptions
```

---

# 36. Backend Module Structure

```text
src/
|
+-- auth/
|   +-- auth.controller.ts
|   +-- auth.service.ts
|   +-- firebase.service.ts
|   +-- guards/
|
+-- users/
|
+-- patients/
|
+-- doctors/
|
+-- departments/
|
+-- doctor-verification/
|
+-- schedules/
|
+-- appointments/
|
+-- payments/
|   +-- razorpay/
|
+-- consultations/
|
+-- medical-records/
|
+-- prescriptions/
|
+-- notifications/
|
+-- admin/
|
+-- audit/
|
+-- storage/
|
+-- common/
|
+-- config/
|
+-- database/
|
+-- main.ts
```

---

# 37. Recommended Database Tables

```text
users
roles
permissions
role_permissions

patients

doctors
doctor_verifications
departments
doctor_schedules
doctor_leaves

appointments
appointment_events

payments
refunds

consultations

medical_records

prescriptions
prescription_items

notifications

platform_settings

audit_logs
```

The following are intentionally excluded:

```text
messages
conversations
chat_rooms
```

because the application does not provide chat.

---

# 38. 300 Concurrent Users

A properly designed Node.js application can support the target of approximately 300 concurrent users without requiring microservices.

Recommended initial deployment:

```text
             Load Balancer
                  |
          +-------+-------+
          |               |
          v               v
       Node #1          Node #2
          |               |
          +-------+-------+
                  |
                Redis
                  |
                MySQL
                  |
          +-------+-------+
          |               |
          v               v
   Object Storage      Razorpay
```

Use:

- MySQL connection pooling
- Proper indexes
- Pagination
- Redis caching
- Efficient queries
- Async background jobs
- Horizontal Node.js scaling

Do not prematurely introduce dozens of microservices.

---

# 39. Redis Usage

Redis can be used for:

- API caching
- Rate limiting
- Temporary appointment holds
- Distributed coordination
- Background job queues
- Session-related temporary data
- Multi-instance coordination

Do **not** use Redis as permanent storage for medical records.

---

# 40. Appointment Hold

To prevent payment races:

```text
Patient selects slot
        |
        v
Create temporary HOLD
        |
        v
Create Razorpay order
        |
        v
Patient pays
        |
        +---- SUCCESS ---> CONFIRMED
        |
        +---- FAILED ----> RELEASE
        |
        +---- TIMEOUT ---> RELEASE
```

The hold should expire automatically.

---

# 41. Recommended Indexes

Important indexes include:

```text
users.phone
users.firebase_uid
users.role

patients.user_id

doctors.user_id
doctors.department_id
doctors.verification_status

doctor_schedules.doctor_id

appointments.doctor_id + appointment_date
appointments.patient_id + appointment_date
appointments.status
appointments.payment_id

payments.gateway_order_id
payments.gateway_payment_id
payments.status

medical_records.patient_id

prescriptions.patient_id
prescriptions.doctor_id

audit_logs.user_id
audit_logs.created_at
```

Exact indexes should be finalized after query profiling.

---

# 42. Admin Dashboard

Admin should initially control:

```text
Dashboard
|
+-- Doctors
|   +-- Pending verification
|   +-- Approved
|   +-- Rejected
|   +-- Suspended
|
+-- Patients
|
+-- Departments
|
+-- Appointments
|
+-- Payments
|
+-- Platform Settings
|   +-- Platform fee ₹99 / ₹100
|
+-- Audit Logs
|
+-- System Status
```

---

# 43. Doctor Dashboard

```text
Doctor Dashboard
|
+-- Profile
|
+-- Verification Status
|
+-- Schedule
|
+-- Today's Appointments
|
+-- Upcoming Appointments
|
+-- Patients
|
+-- Consultations
|
+-- Prescriptions
|
+-- Medical Records
```

---

# 44. Patient Dashboard

```text
Patient Dashboard
|
+-- Profile
|
+-- Medical Records
|
+-- Find Doctor
|
+-- Departments
|
+-- Upcoming Appointments
|
+-- Previous Appointments
|
+-- Payments
|
+-- Prescriptions
|
+-- Consultation Access
```

---

# 45. Development Order

## Phase 1 — Admin

Build first:

```text
Admin Authentication
        |
        v
Admin Dashboard
        |
        v
Departments
        |
        v
Doctor Applications
        |
        v
Doctor Verification
        |
        v
Doctor Activation / Suspension
        |
        v
Patient Management
        |
        v
Appointments
        |
        v
Payments
        |
        v
Platform Fee Settings
        |
        v
Audit Logs
```

## Phase 2 — Doctor

```text
Doctor Registration
        |
        v
Firebase OTP
        |
        v
Doctor Profile
        |
        v
Registration Details
        |
        v
Profile Video
        |
        v
Schedule
        |
        v
Admin Verification
        |
        v
Appointments
        |
        v
Consultations
        |
        v
Prescriptions
```

## Phase 3 — Patient

```text
Patient Registration
        |
        v
Firebase OTP
        |
        v
Patient Profile
        |
        v
Medical Records
        |
        v
Doctor Search
        |
        v
Doctor Profile
        |
        v
Schedule
        |
        v
Appointment
        |
        v
₹99 / ₹100 Razorpay Payment
        |
        v
Appointment Confirmation
        |
        v
Face-to-Face / Audio / Video
        |
        v
Prescription / Records
```

---

# 46. Final Consultation Workflow

```text
Patient
   |
   v
Select Department
   |
   v
Select Doctor
   |
   v
View Doctor Profile
   |
   +-- Name
   +-- Department
   +-- Qualification
   +-- Registration Number
   +-- Experience
   +-- Profile Video
   +-- Profile Photo (if available)
   +-- Case Studies (if available)
   |
   v
Select Date / Time
   |
   v
Select Consultation Mode
   |
   +----------+-----------+
   |          |           |
   v          v           v
Face-to-    Audio       Video
Face                    Google Meet /
                        Zoom
   |          |           |
   +----------+-----------+
              |
              v
        Platform Fee
          ₹99 / ₹100
              |
              v
           Razorpay
              |
              v
       Payment Verified
              |
              v
      Appointment Confirmed
              |
              v
        Consultation
              |
              v
        Doctor Notes
              |
              v
        Prescription
              |
              v
     Medical Record Update
```

---

# 47. Key Architectural Principles

1. **Backend is authoritative.**
   - Never trust prices, IDs, appointment status, or payment status from the client.

2. **Firebase verifies phone ownership.**
   - Backend verifies Firebase authentication tokens.

3. **Only approved doctors can receive appointments.**

4. **Consultation fee is outside the application.**
   - The application collects only the platform fee.

5. **Razorpay handles only the platform fee.**

6. **No in-app chat.**

7. **Medical records are stored in private object storage.**

8. **MySQL stores medical-record metadata, not large file BLOBs.**

9. **Doctor/patient access is controlled using object-level authorization.**

10. **All sensitive operations should be audited.**

11. **Video traffic should not pass through Node.js.**

12. **Start as a modular monolith and scale horizontally.**

13. **Do not sacrifice medical-record readability merely to satisfy the 100 KB limit.**

14. **Platform fee should be configurable as ₹99 or ₹100.**

15. **Security must be designed from the beginning rather than added later.**

---

# 48. Final Architecture Summary

```text
                    ┌─────────────┐
                    │    ADMIN    │
                    └──────┬──────┘
                           |
                    ┌──────▼──────┐
                    │   DOCTOR    │
                    └──────┬──────┘
                           |
                    ┌──────▼──────┐
                    │   PATIENT   │
                    └──────┬──────┘
                           |
                     HTTPS / TLS
                           |
                  ┌────────▼────────┐
                  │  Nginx / LB     │
                  └────────┬────────┘
                           |
                  ┌────────▼────────┐
                  │ NestJS / Node.js│
                  │ Modular Backend │
                  └─────┬─────┬─────┘
                        |     |
                 ┌──────┘     └──────┐
                 v                   v
             ┌───────┐           ┌───────┐
             │ MySQL │           │ Redis │
             └───┬───┘           └───────┘
                 |
        ┌────────┴─────────┐
        v                  v
 Private Object       Audit / Metadata
   Storage
        |
        v
 Medical Records

External:
Firebase OTP
Razorpay
Google Meet / Zoom
Audio Provider
Notification Provider
```

This is the recommended **V1 backend specification** for the application.
