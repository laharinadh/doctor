const departmentService = require('../services/department.service');
const { success, created } = require('../utils/response');

class DepartmentController {
  async getAll(req, res, next) {
    try {
      const { status } = req.query;
      const departments = await departmentService.getAll({ status });
      return success(res, departments, 'Departments fetched successfully');
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const department = await departmentService.getById(req.params.id);
      return success(res, department, 'Department fetched successfully');
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const department = await departmentService.create(req.body);
      return created(res, department, 'Department created successfully');
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const department = await departmentService.update(req.params.id, req.body);
      return success(res, department, 'Department updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await departmentService.delete(req.params.id);
      return success(res, result, 'Department deactivated successfully');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DepartmentController();
