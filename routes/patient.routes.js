const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patient.controller');
const appointmentController = require('../controllers/appointment.controller');
const consultationController = require('../controllers/consultation.controller');
const medicalRecordController = require('../controllers/medical-record.controller');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');
const validate = require('../middleware/validate');
const { uploadMedicalRecord } = require('../middleware/upload');
const { ROLES } = require('../utils/constants');
const { updatePatientProfileSchema } = require('../validators/patient.validator');
const { bookAppointmentSchema, cancelAppointmentSchema } = require('../validators/appointment.validator');

// All patient routes require authentication and PATIENT role
router.use(authenticate, authorize(ROLES.PATIENT));

// Profile
router.get('/profile', patientController.getProfile);
router.patch('/profile', validate(updatePatientProfileSchema), patientController.updateProfile);

// Discovery
router.get('/departments', patientController.browseDepartments);
router.get('/doctors', patientController.browseDoctors);
router.get('/doctors/:id', patientController.getDoctorDetail);
router.get('/doctors/:id/slots', patientController.getDoctorSlots);

// Appointments
router.post('/appointments', validate(bookAppointmentSchema), appointmentController.bookAppointment);
router.get('/appointments', patientController.getMyAppointments);
router.get('/appointments/:id', patientController.getAppointmentDetail);
router.patch('/appointments/:id/cancel', validate(cancelAppointmentSchema), appointmentController.cancelAppointment);

// Consultations
router.get('/consultations', consultationController.getPatientConsultations);

// Medical Records (PDF only, <= 100 KB)
router.post('/medical-records', uploadMedicalRecord.single('file'), medicalRecordController.uploadRecord);
router.get('/medical-records', medicalRecordController.listOwnRecords);
router.get('/medical-records/:id/download', medicalRecordController.downloadRecord);
router.delete('/medical-records/:id', medicalRecordController.deleteRecord);

module.exports = router;
