const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const departmentController = require('../controllers/department.controller');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');
const validate = require('../middleware/validate');
const { ROLES } = require('../utils/constants');
const { createDepartmentSchema, updateDepartmentSchema } = require('../validators/department.validator');
const {
  rejectDoctorSchema,
  updatePlatformSettingsSchema,
  createDoctorSchema,
  updateDoctorSchema,
  bulkCreateDoctorsSchema,
  createPatientSchema,
  updatePatientSchema,
  bulkCreatePatientsSchema,
  createAppointmentSchema,
  updateAppointmentSchema,
  updatePaymentSchema,
} = require('../validators/admin.validator');

// All admin routes require ADMIN role
router.use(authenticate, authorize(ROLES.ADMIN));

// Dashboard metrics
router.get('/dashboard', adminController.getDashboard);

// Doctor management
router.get('/doctors', adminController.listDoctors);
router.post('/doctors', validate(createDoctorSchema), adminController.createDoctor);
router.post('/doctors/bulk', validate(bulkCreateDoctorsSchema), adminController.bulkCreateDoctors);
router.get('/doctors/:id', adminController.getDoctorDetail);
router.patch('/doctors/:id', validate(updateDoctorSchema), adminController.updateDoctor);
router.put('/doctors/:id', validate(updateDoctorSchema), adminController.updateDoctor);
router.delete('/doctors/:id', adminController.deleteDoctor);
router.patch('/doctors/:id/verify', adminController.verifyDoctor);
router.patch('/doctors/:id/reject', validate(rejectDoctorSchema), adminController.rejectDoctor);
router.patch('/doctors/:id/suspend', adminController.suspendDoctor);

// Patient management
router.get('/patients', adminController.listPatients);
router.post('/patients', validate(createPatientSchema), adminController.createPatient);
router.post('/patients/bulk', validate(bulkCreatePatientsSchema), adminController.bulkCreatePatients);
router.get('/patients/:id', adminController.getPatientDetail);
router.patch('/patients/:id', validate(updatePatientSchema), adminController.updatePatient);
router.put('/patients/:id', validate(updatePatientSchema), adminController.updatePatient);
router.delete('/patients/:id', adminController.deletePatient);

// Departments CRUD
router.get('/departments', departmentController.getAll);
router.get('/departments/:id', departmentController.getById);
router.post('/departments', validate(createDepartmentSchema), departmentController.create);
router.patch('/departments/:id', validate(updateDepartmentSchema), departmentController.update);
router.delete('/departments/:id', departmentController.delete);

// Appointments management
router.get('/appointments', adminController.listAppointments);
router.post('/appointments', validate(createAppointmentSchema), adminController.createAppointment);
router.get('/appointments/:id', adminController.getAppointmentDetail);
router.patch('/appointments/:id', validate(updateAppointmentSchema), adminController.updateAppointment);
router.put('/appointments/:id', validate(updateAppointmentSchema), adminController.updateAppointment);
router.delete('/appointments/:id', adminController.deleteAppointment);

// Payments & Refunds
router.get('/payments', adminController.listPayments);
router.patch('/payments/:id', validate(updatePaymentSchema), adminController.updatePayment);
router.delete('/payments/:id', adminController.deletePayment);

// Platform settings
router.get('/settings', adminController.getPlatformSettings);
router.patch('/settings', validate(updatePlatformSettingsSchema), adminController.updatePlatformSettings);

// Audit logs
router.get('/audit-logs', adminController.getAuditLogs);

module.exports = router;

