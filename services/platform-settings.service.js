const db = require('../config/database');
const auditService = require('./audit.service');
const { AUDIT_ACTIONS } = require('../utils/constants');

class PlatformSettingsService {
  async getSettings() {
    const [rows] = await db.query('SELECT * FROM platform_settings WHERE active = 1 ORDER BY id DESC LIMIT 1');
    if (rows.length) {
      return rows[0];
    }
    // Fallback default
    return {
      platform_fee: 99.00,
      currency: 'INR',
      active: 1,
    };
  }

  async updatePlatformFee(fee, adminUserId, ip = null, userAgent = null) {
    const numericFee = parseFloat(fee);
    await db.query(
      'UPDATE platform_settings SET platform_fee = ? WHERE active = 1',
      [numericFee]
    );

    await auditService.log({
      userId: adminUserId,
      role: 'ADMIN',
      action: AUDIT_ACTIONS.ADMIN_UPDATED_SETTINGS,
      resourceType: 'platform_settings',
      metadata: { newPlatformFee: numericFee },
      ip,
      userAgent,
    });

    return this.getSettings();
  }
}

module.exports = new PlatformSettingsService();
