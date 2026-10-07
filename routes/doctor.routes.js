const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctor.controller');
const scheduleController = require('../controllers/schedule.controller');
const consultationController = require('../controllers/consultation.controller');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');
const validate = require('../middleware/validate');
const { ROLES } = require('../utils/constants');
const {
  updateDoctorProfileSchema,
  submitVerificationSchema,
  updateAppointmentStatusSchema,
} = require('../validators/doctor.validator');
const {
  upsertScheduleSchema,
  createLeaveSchema,
} = require('../validators/schedule.validator');

// All doctor routes require DOCTOR role
router.use(authenticate, authorize(ROLES.DOCTOR));

// Profile
router.get('/profile', doctorController.getProfile);
router.patch('/profile', validate(updateDoctorProfileSchema), doctorController.updateProfile);

// Verification
router.post('/verification', validate(submitVerificationSchema), doctorController.submitVerification);
router.get('/verification', doctorController.getVerificationStatus);

// Schedules & Leaves
router.get('/schedule', scheduleController.getSchedules);
router.post('/schedule', validate(upsertScheduleSchema), scheduleController.upsertSchedule);
router.delete('/schedule/:id', scheduleController.deleteSchedule);

router.get('/leave', scheduleController.getLeaves);
router.post('/leave', validate(createLeaveSchema), scheduleController.createLeave);
router.delete('/leave/:id', scheduleController.cancelLeave);

// Appointments
router.get('/appointments', doctorController.getAppointments);
router.patch('/appointments/:id', validate(updateAppointmentStatusSchema), doctorController.updateAppointmentStatus);

// Consultations (doctor notes & completion)
router.get('/consultations', consultationController.getDoctorConsultations);
router.patch('/consultations/:id', consultationController.updateNotesAndComplete);

// Patients & authorized medical records
router.get('/patients', doctorController.getAuthorizedPatients);
router.get('/medical-records/:patientId', doctorController.getPatientMedicalRecords);

module.exports = router;
