import { useState } from 'react';
import { SECOND_OPINION_SPECIALISTS, ALL_DOCTORS } from '../data/doctorsData';
import { inr, toast } from '../ui';

export default function SecondaryOpinion({ onNavigate }) {
  const [step, setStep] = useState('info'); // 'info' | 'form' | 'submitted'
  const [formData, setFormData] = useState({
    patientName: '',
    phone: '',
    email: '',
    age: '',
    gender: '',
    currentDiagnosis: '',
    concernArea: '',
    files: [],
    additionalNotes: '',
    preferredReviewer: '',
    urgency: 'standard',
  });
  const [refId, setRefId] = useState('');

  const concernAreas = [
    'Surgery Necessity Review',
    'Cancer Treatment Plan',
    'Cardiac Procedure Evaluation',
    'Orthopedic Surgery Alternatives',
    'Gynecological Surgery Avoidance',
    'Endocrine / Hormonal Treatment',
    'Neurological Diagnosis',
    'Pediatric Complex Cases',
    'General Multi-Specialist Review',
  ];

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files || []);
    setFormData(prev => ({ ...prev, files: [...prev.files, ...newFiles].slice(0, 5) }));
  };

  const removeFile = (idx) => {
    setFormData(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== idx),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.patientName.trim()) { toast('Please enter patient name'); return; }
    if (!formData.phone.trim()) { toast('Please enter phone number'); return; }
    if (!formData.currentDiagnosis.trim()) { toast('Please describe the current diagnosis'); return; }
    if (!formData.concernArea) { toast('Please select the concern area'); return; }

    const id = 'SO-' + Math.floor(100000 + Math.random() * 900000);
    setRefId(id);
    setStep('submitted');
    toast('Second opinion request submitted successfully!');
  };

  const update = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));

  return (
    <div className="page-secondary-opinion">
      {/* Hero Banner */}
      <section className="sec-hero-banner">
        <div className="sec-banner-inner">
          <div className="sec-badge-pill">
            <span className="sec-badge-icon">📋</span>
            <span>SECONDARY MEDICAL OPINION DESK</span>
          </div>

          <h1 className="sec-page-title">
            Get Expert Second Opinions Before Major Medical Decisions
          </h1>

          <p className="sec-page-subtitle">
            Facing a proposed surgery, complex diagnosis, or uncertain treatment plan? Our multi-disciplinary senior panel reviews your entire case — MRI scans, biopsy reports, prescriptions — and delivers an independent, comprehensive medical opinion within 24–48 hours.
          </p>

          {/* Stats Row */}
          <div className="sec-stats-row">
            <div className="sec-stat-card">
              <b>2,000+</b>
              <span>Second Opinions Delivered</span>
            </div>
            <div className="sec-stat-card">
              <b>18%</b>
              <span>Cases Avoided Unnecessary Surgery</span>
            </div>
            <div className="sec-stat-card">
              <b>24 hrs</b>
              <span>Guaranteed Turnaround</span>
            </div>
            <div className="sec-stat-card">
              <b>100%</b>
              <span>Confidential & Secure</span>
            </div>
          </div>

          {step === 'info' && (
            <button className="sec-cta-hero-btn" onClick={() => setStep('form')}>
              Submit Your Case for Review →
            </button>
          )}
        </div>
      </section>

      {/* How It Works */}
      {step === 'info' && (
        <>
          <section className="sec-how-section">
            <div className="sec-how-container">
              <div className="section-header-centered">
                <span className="section-subtitle">TRANSPARENT PROCESS</span>
                <h2>How Our Second Opinion Works</h2>
                <p>A clear, patient-first process designed for complex cases and critical treatment decisions.</p>
              </div>

              <div className="sec-how-grid">
                <div className="sec-how-card">
                  <div className="sec-step-num">1</div>
                  <h4>Submit Your Case</h4>
                  <p>Fill in patient details, describe your current diagnosis, upload MRI scans, lab reports, biopsy results, or any relevant documents (up to 5 files).</p>
                </div>
                <div className="sec-how-card">
                  <div className="sec-step-num">2</div>
                  <h4>Senior Board Assignment</h4>
                  <p>Our medical coordinator assigns your case to a relevant senior specialist (or panel of specialists) based on your concern area.</p>
                </div>
                <div className="sec-how-card">
                  <div className="sec-step-num">3</div>
                  <h4>Independent Case Audit</h4>
                  <p>The reviewing physician(s) independently analyze all submitted documents, current treatment plans, and imaging without bias from the original provider.</p>
                </div>
                <div className="sec-how-card">
                  <div className="sec-step-num">4</div>
                  <h4>Comprehensive Report & Debrief</h4>
                  <p>You receive a detailed written opinion (PDF) plus a 30-minute video call with the lead reviewer for Q&A and recommended next steps.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Review Board */}
          <section className="sec-board-section">
            <div className="sec-board-container">
              <div className="section-header-centered">
                <span className="section-subtitle">SENIOR MEDICAL PANEL</span>
                <h2>Meet the Review Board</h2>
                <p>Board-certified senior specialists with 10–20 years of active clinical experience in their respective fields.</p>
              </div>

              <div className="sec-board-grid">
                {SECOND_OPINION_SPECIALISTS.map(spec => (
                  <div key={spec.name} className={`sec-board-card ${spec.gender === 'male' ? 'board-blue' : 'board-pink'}`}>
                    <div className="board-avatar-row">
                      <div className={`board-avatar ${spec.gender === 'male' ? 'bav-blue' : 'bav-pink'}`}>
                        {spec.gender === 'male' ? '👨‍⚕️' : '👩‍⚕️'}
                      </div>
                      <div>
                        <h4>{spec.name}</h4>
                        <span className="board-role">{spec.role}</span>
                      </div>
                    </div>
                    <p className="board-specialty">{spec.specialty}</p>
                    <div className="board-meta">
                      <span>🎓 {spec.qualification}</span>
                      <span>💼 {spec.exp} experience</span>
                      <span>★ {spec.casesReviewed}+ cases reviewed</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Common Concerns */}
          <section className="sec-concerns-section">
            <div className="sec-concerns-container">
              <div className="section-header-centered">
                <span className="section-subtitle">WHEN TO SEEK</span>
                <h2>Common Reasons to Get a Second Opinion</h2>
              </div>

              <div className="sec-concerns-grid">
                {[
                  { icon: '🔪', title: 'Surgery Recommendation', desc: 'Is surgery truly necessary? Our board evaluates conservative alternatives, medication-based therapies, and timing.' },
                  { icon: '🧬', title: 'Cancer Staging & Treatment', desc: 'Verify oncology staging accuracy and review chemotherapy vs. radiation vs. immunotherapy plans.' },
                  { icon: '🫀', title: 'Cardiac Procedure Evaluation', desc: 'Coronary angioplasty, bypass, or valve replacement — confirm urgency and explore less invasive options.' },
                  { icon: '🦴', title: 'Orthopedic Surgery Avoidance', desc: 'Knee/hip replacement, spinal fusion, or arthroscopy — assess physiotherapy alternatives and surgical necessity.' },
                  { icon: '🌸', title: 'Gynecological Surgery', desc: 'Hysterectomy, fibroid removal, or PCOS surgical interventions — evaluate hormonal and pharmacological alternatives.' },
                  { icon: '❓', title: 'Ambiguous or Conflicting Diagnosis', desc: 'When two doctors disagree, our board provides an independent, evidence-based tie-breaking evaluation.' },
                ].map(item => (
                  <div key={item.title} className="sec-concern-card">
                    <span className="concern-ic">{item.icon}</span>
                    <h4>{item.title}</h4>
                    <p>{item.desc}</p>
                  </div>
                ))}
              </div>

              <div style={{ textAlign: 'center', marginTop: 28 }}>
                <button className="sec-cta-large-btn" onClick={() => setStep('form')}>
                  Submit Your Case for Review →
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Submission Form */}
      {step === 'form' && (
        <section className="sec-form-section">
          <div className="sec-form-container">
            <div className="sec-form-header">
              <button className="sec-back-btn" onClick={() => setStep('info')}>
                ← Back to Information
              </button>
              <h2>Submit Your Case for Second Opinion</h2>
              <p>Fill in the details below. Our team will assign a senior reviewer and respond within 24 hours.</p>
            </div>

            <form className="sec-submission-form" onSubmit={handleSubmit}>
              {/* Patient Details */}
              <fieldset className="sec-fieldset">
                <legend>Patient Information</legend>
                <div className="sec-form-grid">
                  <div className="sec-field">
                    <label>Patient Full Name *</label>
                    <input
                      type="text"
                      value={formData.patientName}
                      onChange={e => update('patientName', e.target.value)}
                      placeholder="Enter patient full name"
                      required
                    />
                  </div>
                  <div className="sec-field">
                    <label>Phone Number *</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={e => update('phone', e.target.value)}
                      placeholder="+91 XXXXX XXXXX"
                      required
                    />
                  </div>
                  <div className="sec-field">
                    <label>Email Address</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => update('email', e.target.value)}
                      placeholder="patient@example.com"
                    />
                  </div>
                  <div className="sec-field half">
                    <label>Age</label>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      value={formData.age}
                      onChange={e => update('age', e.target.value)}
                      placeholder="Age"
                    />
                  </div>
                  <div className="sec-field half">
                    <label>Gender</label>
                    <select
                      value={formData.gender}
                      onChange={e => update('gender', e.target.value)}
                    >
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </fieldset>

              {/* Case Details */}
              <fieldset className="sec-fieldset">
                <legend>Case Details</legend>
                <div className="sec-form-grid">
                  <div className="sec-field full">
                    <label>Current Diagnosis / Condition *</label>
                    <textarea
                      rows="3"
                      value={formData.currentDiagnosis}
                      onChange={e => update('currentDiagnosis', e.target.value)}
                      placeholder="Describe the current diagnosis, proposed treatment, and what you want reviewed..."
                      required
                    />
                  </div>
                  <div className="sec-field">
                    <label>Concern Area *</label>
                    <select
                      value={formData.concernArea}
                      onChange={e => update('concernArea', e.target.value)}
                      required
                    >
                      <option value="">Select concern area</option>
                      {concernAreas.map(area => (
                        <option key={area} value={area}>{area}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sec-field">
                    <label>Urgency</label>
                    <select
                      value={formData.urgency}
                      onChange={e => update('urgency', e.target.value)}
                    >
                      <option value="standard">Standard (24–48h report)</option>
                      <option value="urgent">Urgent (12h priority review)</option>
                      <option value="critical">Critical (6h emergency board)</option>
                    </select>
                  </div>
                  <div className="sec-field">
                    <label>Preferred Reviewer (optional)</label>
                    <select
                      value={formData.preferredReviewer}
                      onChange={e => update('preferredReviewer', e.target.value)}
                    >
                      <option value="">Auto-assign best available</option>
                      {SECOND_OPINION_SPECIALISTS.map(s => (
                        <option key={s.name} value={s.name}>{s.name} — {s.specialty}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </fieldset>

              {/* File Uploads */}
              <fieldset className="sec-fieldset">
                <legend>Upload Medical Documents (up to 5)</legend>
                <div className="sec-upload-area">
                  <label className="sec-upload-label">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.dicom,.doc,.docx"
                      multiple
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                    <div className="sec-upload-placeholder">
                      <span className="upload-icon">📎</span>
                      <span>Click to upload MRI, CT, blood work, biopsy, prescriptions</span>
                      <small>PDF, JPG, PNG, DICOM — max 5 files, 10 MB each</small>
                    </div>
                  </label>

                  {formData.files.length > 0 && (
                    <div className="sec-file-list">
                      {formData.files.map((f, i) => (
                        <div key={i} className="sec-file-chip">
                          <span>📄 {f.name}</span>
                          <button type="button" onClick={() => removeFile(i)} className="remove-file-btn">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </fieldset>

              {/* Additional Notes */}
              <fieldset className="sec-fieldset">
                <legend>Additional Notes</legend>
                <textarea
                  rows="3"
                  value={formData.additionalNotes}
                  onChange={e => update('additionalNotes', e.target.value)}
                  placeholder="Any specific questions for the reviewer, medication allergies, or past treatment history..."
                />
              </fieldset>

              {/* Pricing & Submit */}
              <div className="sec-form-footer">
                <div className="sec-pricing-info">
                  <div className="sec-price-card">
                    <span className="price-label">Standard Review (24–48h)</span>
                    <b className="price-val">{inr(1499)}</b>
                  </div>
                  <div className="sec-price-card highlight">
                    <span className="price-label">Urgent Review (12h)</span>
                    <b className="price-val">{inr(2999)}</b>
                  </div>
                  <div className="sec-price-card">
                    <span className="price-label">Critical Board (6h)</span>
                    <b className="price-val">{inr(4999)}</b>
                  </div>
                </div>

                <button type="submit" className="sec-submit-btn">
                  Submit for Second Opinion →
                </button>

                <p className="sec-disclaimer">
                  By submitting, you agree to our Telemedicine Terms and Data Privacy Policy. Second opinions are advisory and do not replace direct clinical examination.
                </p>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* Submitted Success */}
      {step === 'submitted' && (
        <section className="sec-success-section">
          <div className="sec-success-container">
            <div className="sec-success-icon">✓</div>
            <h2>Your Second Opinion Request Has Been Submitted</h2>
            <p className="sec-success-sub">
              Our medical coordinator will review your submission and assign a senior specialist within the next 2 hours.
            </p>

            <div className="sec-success-ticket">
              <div className="ticket-row">
                <span>Reference ID</span>
                <b>{refId}</b>
              </div>
              <div className="ticket-row">
                <span>Patient</span>
                <b>{formData.patientName}</b>
              </div>
              <div className="ticket-row">
                <span>Concern Area</span>
                <span>{formData.concernArea}</span>
              </div>
              <div className="ticket-row">
                <span>Urgency</span>
                <span style={{ textTransform: 'capitalize' }}>{formData.urgency}</span>
              </div>
              <div className="ticket-row">
                <span>Documents Uploaded</span>
                <span>{formData.files.length} file(s)</span>
              </div>
              <div className="ticket-row">
                <span>Expected Report</span>
                <b>{formData.urgency === 'critical' ? '6 hours' : formData.urgency === 'urgent' ? '12 hours' : '24–48 hours'}</b>
              </div>
            </div>

            <p className="sec-next-steps">
              📩 A confirmation SMS has been sent to {formData.phone}. You will receive your full written opinion and video-call scheduling link at your email address.
            </p>

            <div className="sec-success-actions">
              <button className="sec-cta-large-btn" onClick={() => { setStep('info'); setFormData({ patientName: '', phone: '', email: '', age: '', gender: '', currentDiagnosis: '', concernArea: '', files: [], additionalNotes: '', preferredReviewer: '', urgency: 'standard' }); }}>
                Submit Another Case
              </button>
              <button className="sec-outline-btn" onClick={() => onNavigate('home')}>
                ← Back to Home
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
