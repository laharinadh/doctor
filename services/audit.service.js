const db = require('../config/database');
const logger = require('../utils/logger');

class AuditService {
  async log({
    userId = null,
    role = null,
    action,
    resourceType = null,
    resourceId = null,
    ip = null,
    userAgent = null,
    metadata = null,
  }) {
    try {
      // Ensure no sensitive PHI is ever passed into metadata
      let safeMetadata = null;
      if (metadata && typeof metadata === 'object') {
        const sanitized = { ...metadata };
        delete sanitized.notes;
        delete sanitized.doctorNotes;
        delete sanitized.medicalDetails;
        delete sanitized.password;
        delete sanitized.token;
        safeMetadata = JSON.stringify(sanitized);
      }

      await db.query(
        `INSERT INTO audit_logs 
          (user_id, role, action, resource_type, resource_id, ip_address, user_agent, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, role, action, resourceType, resourceId ? String(resourceId) : null, ip, userAgent, safeMetadata]
      );
    } catch (err) {
      logger.error('Failed to write audit log:', err);
    }
  }

  async getLogs({ page = 1, limit = 20, action = null, userId = null }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (action) {
      conditions.push('action = ?');
      params.push(action);
    }
    if (userId) {
      conditions.push('user_id = ?');
      params.push(userId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`;
    const [countResult] = await db.query(countSql, params);
    const total = countResult[0].total;

    const dataSql = `
      SELECT id, user_id, role, action, resource_type, resource_id, ip_address, user_agent, metadata, created_at
      FROM audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await db.query(dataSql, [...params, limit, offset]);

    return {
      items: rows,
      total,
      page,
      limit,
    };
  }
}

module.exports = new AuditService();
