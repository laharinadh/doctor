import { useState, useMemo } from 'react';
import { FEMALE_DOCTORS } from '../data/doctorsData';
import BookingModal from '../components/BookingModal';
import { inr } from '../ui';

export default function FemaleDoctors({ initialFilter = {}, onNavigate, onOpenDashboard }) {
  const [search, setSearch] = useState(initialFilter.search || '');
  const [selectedDept, setSelectedDept] = useState(initialFilter.dept || 'All');
  const [selectedMode, setSelectedMode] = useState('All');
  const [onlyToday, setOnlyToday] = useState(false);
  const [bookingDoctor, setBookingDoctor] = useState(null);

  const departments = ['All', 'Cardiology', 'Gynecology & Obstetrics', 'Pediatrics', 'Dermatology', 'Endocrinology', 'Psychiatry'];

  const filteredDoctors = useMemo(() => {
    return FEMALE_DOCTORS.filter(doc => {
      const matchSearch = !search.trim() ||
        doc.name.toLowerCase().includes(search.toLowerCase()) ||
        doc.department.toLowerCase().includes(search.toLowerCase()) ||
        doc.about.toLowerCase().includes(search.toLowerCase()) ||
        doc.qualification.toLowerCase().includes(search.toLowerCase());

      const matchDept = selectedDept === 'All' || doc.department === selectedDept;
      const matchMode = selectedMode === 'All' || doc.modes.includes(selectedMode);
      const matchToday = !onlyToday || doc.availableToday;

      return matchSearch && matchDept && matchMode && matchToday;
    });
  }, [search, selectedDept, selectedMode, onlyToday]);

  return (
    <div className="page-pink-theme">
      {/* Pink Hero Banner */}
      <section className="pink-hero-banner">
        <div className="pink-banner-inner">
          <div className="pink-badge-pill">
            <span className="p-badge-icon">👩‍⚕️</span>
            <span>FEMALE SPECIALISTS DIRECTORY • PINK PORTAL</span>
          </div>

          <h1 className="pink-page-title">
            Consult Top Female Doctors & Specialists
          </h1>

          <p className="pink-page-subtitle">
            Connect with compassionate, board-certified female physicians and surgeons across Gynecology, Pediatrics, Cardiology, Dermatology, Endocrinology, and Mental Health.
          </p>

          {/* Quick stats in pink */}
          <div className="pink-stats-row">
            <div className="pink-stat-card">
              <b>14+</b>
              <span>Senior Female Specialists</span>
            </div>
            <div className="pink-stat-card">
              <b>22,000+</b>
              <span>Consultations Delivered</span>
            </div>
            <div className="pink-stat-card">
              <b>99.1%</b>
              <span>Patient Satisfaction</span>
            </div>
            <div className="pink-stat-card">
              <b>24/7</b>
              <span>Video Slots for Emergencies</span>
            </div>
          </div>
        </div>
      </section>

      {/* Filter and Search Bar (Themed in Pink) */}
      <section className="pink-filter-section">
        <div className="pink-filter-container">
          {/* Search box */}
          <div className="pink-search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search female doctors by name, specialty, condition, or hospital..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="clear-search-btn" onClick={() => setSearch('')}>✕</button>
            )}
          </div>

          {/* Department pills */}
          <div className="pink-pills-row">
            <span className="filter-label">Specialty:</span>
            {departments.map(dept => (
              <button
                key={dept}
                className={`pink-pill-btn ${selectedDept === dept ? 'active' : ''}`}
                onClick={() => setSelectedDept(dept)}
              >
                {dept}
              </button>
            ))}
          </div>

          {/* Secondary filter options */}
          <div className="pink-subfilters-row">
            <div className="filter-group">
              <label>Consultation Mode:</label>
              <select
                value={selectedMode}
                onChange={e => setSelectedMode(e.target.value)}
                className="pink-select"
              >
                <option value="All">All Modes (Video, Audio, Clinic)</option>
                <option value="VIDEO">Video Consultation</option>
                <option value="AUDIO">Audio Call</option>
                <option value="IN_PERSON">In-Person Clinic Visit</option>
              </select>
            </div>

            <label className="pink-checkbox-label">
              <input
                type="checkbox"
                checked={onlyToday}
                onChange={e => setOnlyToday(e.target.checked)}
              />
              <span>Available Today Only</span>
            </label>

            <span className="pink-result-count">
              Showing <strong>{filteredDoctors.length}</strong> Female Doctors
            </span>
          </div>
        </div>
      </section>

      {/* Doctors Grid */}
      <section className="pink-doctors-list-section">
        <div className="pink-list-container">
          {filteredDoctors.length === 0 ? (
            <div className="pink-empty-state">
              <span className="empty-icon">👩‍⚕️</span>
              <h3>No female doctors found matching your filters</h3>
              <p>Try clearing your search query or choosing "All" departments to see all specialists.</p>
              <button
                className="pink-primary-btn"
                onClick={() => { setSearch(''); setSelectedDept('All'); setSelectedMode('All'); setOnlyToday(false); }}
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="pink-doctors-grid">
              {filteredDoctors.map(doctor => (
                <div key={doctor.id} className="pink-doctor-card">
                  {/* Card Header */}
                  <div className="doc-card-header">
                    <div className="doc-avatar-container">
                      <div className="pink-avatar-ring">
                        <span className="avatar-initials">
                          {doctor.name.replace(/^Dr\.\s+/, '').split(' ').map(w => w[0]).slice(0, 2).join('')}
                        </span>
                      </div>
                      <span className="female-gender-badge" title="Female Doctor">👩‍⚕️</span>
                    </div>

                    <div className="doc-headline-info">
                      <div className="doc-dept-badge-pink">{doctor.department}</div>
                      <h3 className="doc-name-pink">{doctor.name}</h3>
                      <p className="doc-title-sub">{doctor.title}</p>
                      <div className="doc-meta-row">
                        <span className="meta-exp">💼 {doctor.experience} yrs exp</span>
                        <span className="meta-rating">★ {doctor.rating} ({doctor.reviews} reviews)</span>
                      </div>
                    </div>
                  </div>

                  {/* Body Info */}
                  <div className="doc-body-info">
                    <div className="doc-qualification">
                      <strong>Qualification:</strong> {doctor.qualification}
                    </div>
                    <div className="doc-hospital">
                      <strong>Affiliation:</strong> {doctor.hospital}
                    </div>
                    <div className="doc-reg">
                      <small>Reg. No: {doctor.registration_no}</small>
                    </div>

                    <p className="doc-about-text">{doctor.about}</p>

                    {/* Key Cases */}
                    <div className="doc-cases-box pink-cases">
                      <strong>Clinical Highlights:</strong>
                      <ul>
                        {doctor.cases.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Consultation Modes */}
                    <div className="doc-modes-tags">
                      {doctor.modes.map(m => (
                        <span key={m} className="pink-mode-pill">
                          {m === 'VIDEO' ? '📹 Video' : m === 'AUDIO' ? '📞 Audio' : '🏥 Clinic'}
                        </span>
                      ))}
                      {doctor.availableToday && (
                        <span className="today-badge pink-today">⚡ Available Today</span>
                      )}
                    </div>

                    {/* Languages */}
                    <div className="doc-lang-row">
                      <small>🌐 Languages: {doctor.languages.join(', ')}</small>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="doc-card-footer">
                    <div className="doc-fee-box">
                      <small>Consultation Fee</small>
                      <b>{inr(doctor.fee)}</b>
                    </div>

                    <div className="doc-action-buttons">
                      <button
                        className="pink-book-btn"
                        onClick={() => setBookingDoctor(doctor)}
                      >
                        Book Appointment
                      </button>
                      <button
                        className="pink-second-op-btn"
                        onClick={() => onNavigate('secondary-opinion', { doctorId: doctor.id })}
                        title="Request Second Opinion from this doctor"
                      >
                        Second Opinion
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Women's & Children's Health Spotlight */}
      <section className="pink-specialty-guide-section">
        <div className="pink-guide-container">
          <div className="pink-guide-header">
            <span className="p-guide-pill">WOMEN'S & CHILDREN'S HEALTH</span>
            <h2>Comprehensive Women's Wellness & Child Care</h2>
            <p>Our leading female specialists bring deep empathy and clinical excellence to maternal health, hormonal therapies, pediatric care, and women's mental wellness.</p>
          </div>

          <div className="pink-guide-grid">
            <div className="pink-guide-card">
              <span className="guide-ic">🌸</span>
              <h4>Gynecology & Obstetrics</h4>
              <p>High-risk pregnancies, PCOS & PCOD management, fibroid evaluations, hormonal wellness, and safe deliveries.</p>
            </div>
            <div className="pink-guide-card">
              <span className="guide-ic">👶</span>
              <h4>Pediatrics & Neonatology</h4>
              <p>Newborn care, immunization schedules, child growth monitoring, childhood infections, and allergy management.</p>
            </div>
            <div className="pink-guide-card">
              <span className="guide-ic">🔬</span>
              <h4>Endocrinology & Thyroid</h4>
              <p>Thyroid dysfunction, gestational diabetes, osteoporosis management, metabolic syndrome, and insulin resistance protocols.</p>
            </div>
            <div className="pink-guide-card">
              <span className="guide-ic">🌱</span>
              <h4>Mental Health & Psychiatry</h4>
              <p>Postpartum depression, anxiety disorders, burnout recovery, insomnia therapy, and compassionate cognitive care.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Booking Modal */}
      {bookingDoctor && (
        <BookingModal
          doctor={bookingDoctor}
          onClose={() => setBookingDoctor(null)}
          onBookSuccess={() => {}}
          onOpenDashboard={onOpenDashboard}
        />
      )}
    </div>
  );
}
