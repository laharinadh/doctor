const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const departmentController = require('../controllers/department.controller');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');
const validate = require('../middleware/validate');
const { ROLES } = require('../utils/constants');
const { createDepartmentSchema, updateDepartmentSchema } = require('../validators/department.validator');
const { rejectDoctorSchema, updatePlatformSettingsSchema } = require('../validators/admin.validator');

// All admin routes require ADMIN role
router.use(authenticate, authorize(ROLES.ADMIN));

// Dashboard metrics
router.get('/dashboard', adminController.getDashboard);

// Doctor management
router.get('/doctors', adminController.listDoctors);
router.get('/doctors/:id', adminController.getDoctorDetail);
router.patch('/doctors/:id/verify', adminController.verifyDoctor);
router.patch('/doctors/:id/reject', validate(rejectDoctorSchema), adminController.rejectDoctor);
router.patch('/doctors/:id/suspend', adminController.suspendDoctor);

// Patients
router.get('/patients', adminController.listPatients);

// Departments CRUD
router.get('/departments', departmentController.getAll);
router.get('/departments/:id', departmentController.getById);
router.post('/departments', validate(createDepartmentSchema), departmentController.create);
router.patch('/departments/:id', validate(updateDepartmentSchema), departmentController.update);
router.delete('/departments/:id', departmentController.delete);

// Appointments & Payments
router.get('/appointments', adminController.listAppointments);
router.get('/payments', adminController.listPayments);

// Platform settings
router.get('/settings', adminController.getPlatformSettings);
router.patch('/settings', validate(updatePlatformSettingsSchema), adminController.updatePlatformSettings);

// Audit logs
router.get('/audit-logs', adminController.getAuditLogs);

module.exports = router;
