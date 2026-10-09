const crypto = require('crypto');
const db = require('../config/database');
const config = require('../config');
const { BadRequestError, ForbiddenError, NotFoundError, ConflictError, UnauthorizedError } = require('../utils/errors');

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const sign = value => crypto.createHmac('sha256', config.security.instantRoomSecret).update(value).digest('base64url');
const safe = row => { if (!row) return row; const { room_token_hash, ...publicRow } = row; return publicRow; };

class InstantConsultationService {
  async request(patientId, doctorId, instantPaymentId) {
    const [doctors] = await db.query(`SELECT id FROM doctors WHERE id = ? AND status = 'ACTIVE' AND verification_status = 'APPROVED'`, [doctorId]);
    if (!doctors.length) throw new NotFoundError('Doctor is not available for instant consultation');
    if (!instantPaymentId) throw new BadRequestError('Pay the ₹99 instant consultation fee before requesting a call');
    const consultationId = await db.withTransaction(async conn => {
      const [payments] = await conn.query(`SELECT id FROM instant_consultation_payments WHERE id=? AND patient_id=? AND doctor_id=? AND status='SUCCESS' AND consultation_id IS NULL FOR UPDATE`, [instantPaymentId, patientId, doctorId]);
      if (!payments.length) throw new UnauthorizedError('Instant consultation payment is missing or already used');
      const [active] = await conn.query(`SELECT id FROM instant_consultations WHERE doctor_id = ? AND status IN ('REQUESTED','ACCEPTED','ACTIVE') AND expires_at > NOW() LIMIT 1 FOR UPDATE`, [doctorId]);
      if (active.length) throw new ConflictError('This doctor is already handling an instant consultation');
      const [result] = await conn.query(`INSERT INTO instant_consultations (patient_id, doctor_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))`, [patientId, doctorId]);
      await conn.query(`UPDATE instant_consultation_payments SET consultation_id=? WHERE id=?`, [result.insertId, instantPaymentId]);
      return result.insertId;
    });
    return this.getForPatient(consultationId, patientId);
  }

  async listForDoctor(doctorId) {
    const [rows] = await db.query(`SELECT i.*, p.name patient_name, p.phone patient_phone, d.name doctor_name FROM instant_consultations i JOIN patients p ON p.id=i.patient_id JOIN doctors d ON d.id=i.doctor_id WHERE i.doctor_id = ? AND i.status IN ('REQUESTED','ACCEPTED','ACTIVE') AND i.expires_at > NOW() ORDER BY i.requested_at ASC`, [doctorId]);
    return rows.map(safe);
  }

  async listForPatient(patientId) {
    const [rows] = await db.query(`SELECT i.*, p.name patient_name, d.name doctor_name FROM instant_consultations i JOIN patients p ON p.id=i.patient_id JOIN doctors d ON d.id=i.doctor_id WHERE i.patient_id = ? AND i.status IN ('REQUESTED','ACCEPTED','ACTIVE') AND i.expires_at > NOW() ORDER BY i.requested_at DESC`, [patientId]);
    return rows.map(safe);
  }

  async get(id, actorId, role) {
    const where = role === 'DOCTOR' ? 'i.doctor_id = (SELECT id FROM doctors WHERE user_id = ?)' : 'i.patient_id = (SELECT id FROM patients WHERE user_id = ?)';
    const [rows] = await db.query(`SELECT i.*, p.name patient_name, d.name doctor_name FROM instant_consultations i JOIN patients p ON p.id=i.patient_id JOIN doctors d ON d.id=i.doctor_id WHERE i.id = ? AND ${where}`, [id, actorId]);
    if (!rows.length) throw new NotFoundError('Instant consultation not found');
    return safe(rows[0]);
  }

  async getForPatient(id, patientId) {
    const [rows] = await db.query(`SELECT i.*, p.name patient_name, d.name doctor_name FROM instant_consultations i JOIN patients p ON p.id=i.patient_id JOIN doctors d ON d.id=i.doctor_id WHERE i.id = ? AND i.patient_id = ?`, [id, patientId]);
    if (!rows.length) throw new NotFoundError('Instant consultation not found');
    return safe(rows[0]);
  }

  async accept(id, doctorId) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query(`SELECT id FROM instant_consultations WHERE id = ? AND doctor_id = ? AND status = 'REQUESTED' AND expires_at > NOW() FOR UPDATE`, [id, doctorId]);
      if (!rows.length) throw new ConflictError('Request is no longer available');
      await conn.query(`UPDATE instant_consultations SET status='ACCEPTED', accepted_at=NOW() WHERE id=?`, [id]);
      await conn.commit();
      return await this.getForDoctor(id, doctorId);
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  }

  async getForDoctor(id, doctorId) {
    const [rows] = await db.query(`SELECT i.*, p.name patient_name, d.name doctor_name FROM instant_consultations i JOIN patients p ON p.id=i.patient_id JOIN doctors d ON d.id=i.doctor_id WHERE i.id=? AND i.doctor_id=?`, [id, doctorId]);
    if (!rows.length) throw new NotFoundError('Instant consultation not found');
    return safe(rows[0]);
  }

  async join(id, actorUserId, role) {
    const consultation = await this.get(id, actorUserId, role);
    if (!['ACCEPTED', 'ACTIVE'].includes(consultation.status) || new Date(consultation.expires_at) <= new Date()) {
      throw new ConflictError('This instant consultation is not available to join');
    }
    await db.query(`UPDATE instant_consultations SET status='ACTIVE', started_at=COALESCE(started_at, NOW()) WHERE id=? AND status IN ('ACCEPTED','ACTIVE')`, [id]);
    const payload = Buffer.from(JSON.stringify({ id: Number(id), userId: Number(actorUserId), role, exp: Date.now() + 60 * 60 * 1000 })).toString('base64url');
    return { consultationId: Number(id), role, roomToken: `${payload}.${sign(payload)}` };
  }

  verifyRoomToken(token) {
    if (!token || typeof token !== 'string') throw new ForbiddenError('Missing consultation room token');
    const [payload, signature] = token.split('.');
    const expected = sign(payload);
    if (!payload || !signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new ForbiddenError('Invalid consultation room token');
    let data;
    try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { throw new ForbiddenError('Invalid consultation room token'); }
    if (!data.id || !data.userId || !data.role || data.exp < Date.now()) throw new ForbiddenError('Expired consultation room token');
    return data;
  }

  async end(id, actorUserId, role) {
    await this.get(id, actorUserId, role);
    await db.query(`UPDATE instant_consultations SET status='COMPLETED', ended_at=NOW() WHERE id=? AND status IN ('ACCEPTED','ACTIVE')`, [id]);
    return this.get(id, actorUserId, role);
  }

  async submitCaseStudy(id, doctorId, input = {}) {
    const [consultations] = await db.query(`SELECT id, patient_id, doctor_id, status FROM instant_consultations WHERE id=? AND doctor_id=?`, [id, doctorId]);
    if (!consultations.length) throw new NotFoundError('Instant consultation not found or not assigned to you');
    if (consultations[0].status !== 'COMPLETED') throw new ConflictError('Complete the consultation before submitting a case study');
    const title = String(input.title || '').trim();
    const clinicalSummary = String(input.clinicalSummary || input.clinical_summary || '').trim();
    if (title.length < 3 || title.length > 255) throw new BadRequestError('Case study title must be between 3 and 255 characters');
    if (clinicalSummary.length < 10) throw new BadRequestError('Clinical summary must be at least 10 characters');
    await db.query(`INSERT INTO instant_case_studies (instant_consultation_id, doctor_id, patient_id, title, clinical_summary, diagnosis, treatment_plan, follow_up) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title), clinical_summary=VALUES(clinical_summary), diagnosis=VALUES(diagnosis), treatment_plan=VALUES(treatment_plan), follow_up=VALUES(follow_up)`, [id, doctorId, consultations[0].patient_id, title, clinicalSummary, input.diagnosis || null, input.treatmentPlan || input.treatment_plan || null, input.followUp || input.follow_up || null]);
    const [rows] = await db.query(`SELECT * FROM instant_case_studies WHERE instant_consultation_id=?`, [id]);
    return rows[0];
  }

  async getCaseStudy(id, actorId, role) {
    await this.get(id, actorId, role);
    const [rows] = await db.query(`SELECT c.* FROM instant_case_studies c WHERE c.instant_consultation_id=?`, [id]);
    return rows[0] || null;
  }

  async signal(id, actorUserId, role, type, payload) {
    if (!['OFFER','ANSWER','ICE','HANGUP'].includes(type)) throw new BadRequestError('Invalid WebRTC signal type');
    const consultation = await this.get(id, actorUserId, role);
    if (!['ACCEPTED', 'ACTIVE'].includes(consultation.status)) throw new ConflictError('Consultation is not active');
    await db.query('INSERT INTO instant_signals (consultation_id, sender_user_id, signal_type, payload) VALUES (?, ?, ?, ?)', [id, actorUserId, type, JSON.stringify(payload || {})]);
    return { ok: true };
  }

  async signals(id, actorUserId, role, after = 0) {
    const consultation = await this.get(id, actorUserId, role);
    if (!['ACCEPTED', 'ACTIVE'].includes(consultation.status)) throw new ConflictError('Consultation is not active');
    const [rows] = await db.query('SELECT id, sender_user_id, signal_type, payload, created_at FROM instant_signals WHERE consultation_id=? AND id>? ORDER BY id ASC LIMIT 100', [id, Number(after) || 0]);
    return rows.map(x => ({ ...x, payload: typeof x.payload === 'string' ? JSON.parse(x.payload) : x.payload }));
  }
}
module.exports = new InstantConsultationService();
