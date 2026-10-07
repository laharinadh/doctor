const db = require('../config/database');
const { NotFoundError, ConflictError } = require('../utils/errors');

class DepartmentService {
  async getAll({ status = null } = {}) {
    let sql = 'SELECT * FROM departments';
    const params = [];
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY name ASC';
    const [rows] = await db.query(sql, params);
    return rows;
  }

  async getById(id) {
    const [rows] = await db.query('SELECT * FROM departments WHERE id = ?', [id]);
    if (!rows.length) {
      throw new NotFoundError('Department not found');
    }
    return rows[0];
  }

  async create({ name, description = null }) {
    const [existing] = await db.query('SELECT id FROM departments WHERE name = ?', [name]);
    if (existing.length) {
      throw new ConflictError('A department with this name already exists');
    }

    const [result] = await db.query(
      'INSERT INTO departments (name, description, status) VALUES (?, ?, ?)',
      [name, description, 'ACTIVE']
    );

    return this.getById(result.insertId);
  }

  async update(id, { name, description, status }) {
    await this.getById(id);

    if (name) {
      const [existing] = await db.query('SELECT id FROM departments WHERE name = ? AND id != ?', [name, id]);
      if (existing.length) {
        throw new ConflictError('A department with this name already exists');
      }
    }

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length > 0) {
      params.push(id);
      await db.query(`UPDATE departments SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    return this.getById(id);
  }

  async delete(id) {
    await this.getById(id);
    // Soft delete
    await db.query('UPDATE departments SET status = ? WHERE id = ?', ['INACTIVE', id]);
    return { success: true, message: 'Department deactivated successfully' };
  }
}

module.exports = new DepartmentService();
