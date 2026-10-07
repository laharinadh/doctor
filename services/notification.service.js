const db = require('../config/database');
const { NotFoundError } = require('../utils/errors');
const { getPaginationParams } = require('../utils/pagination');

class NotificationService {
  async create({ userId, type, title, body = null, channel = 'IN_APP' }) {
    const [res] = await db.query(
      `INSERT INTO notifications (user_id, type, title, body, channel, status)
       VALUES (?, ?, ?, ?, ?, 'PENDING')`,
      [userId, type, title, body, channel]
    );

    return { id: res.insertId, userId, type, title, body, status: 'PENDING' };
  }

  async getUserNotifications(userId, query) {
    const { page, limit, offset } = getPaginationParams(query);
    const conditions = ['user_id = ?'];
    const params = [userId];

    if (query.unreadOnly === 'true') {
      conditions.push('read_at IS NULL');
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countSql = `SELECT COUNT(*) as total FROM notifications ${whereClause}`;
    const [countResult] = await db.query(countSql, params);
    const total = countResult[0].total;

    const dataSql = `
      SELECT * FROM notifications 
      ${whereClause} 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    const [rows] = await db.query(dataSql, [...params, limit, offset]);

    return { items: rows, total, page, limit };
  }

  async markAsRead(notificationId, userId) {
    const [rows] = await db.query(
      'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );

    if (!rows.length) {
      throw new NotFoundError('Notification not found');
    }

    await db.query(
      'UPDATE notifications SET status = "READ", read_at = CURRENT_TIMESTAMP WHERE id = ?',
      [notificationId]
    );

    return { success: true, message: 'Notification marked as read' };
  }

  async markAllAsRead(userId) {
    await db.query(
      'UPDATE notifications SET status = "READ", read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL',
      [userId]
    );
    return { success: true, message: 'All notifications marked as read' };
  }
}

module.exports = new NotificationService();
