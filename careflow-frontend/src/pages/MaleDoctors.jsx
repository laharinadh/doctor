import { useState, useMemo } from 'react';
import { MALE_DOCTORS } from '../data/doctorsData';
import BookingModal from '../components/BookingModal';
import { inr } from '../ui';

export default function MaleDoctors({ initialFilter = {}, onNavigate, onOpenDashboard }) {
  const [search, setSearch] = useState(initialFilter.search || '');
  const [selectedDept, setSelectedDept] = useState(initialFilter.dept || 'All');
  const [selectedMode, setSelectedMode] = useState('All');
  const [onlyToday, setOnlyToday] = useState(false);
  const [bookingDoctor, setBookingDoctor] = useState(null);

  const departments = ['All', 'Cardiology', 'Dermatology', 'Orthopedics', 'Neurology', 'Internal Medicine', 'Urology', 'General Medicine', 'ENT', 'Pediatrics'];

  const filteredDoctors = useMemo(() => {
    return MALE_DOCTORS.filter(doc => {
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
    <div className="page-blue-theme">
      {/* Blue Hero Banner */}
      <section className="blue-hero-banner">
        <div className="blue-banner-inner">
          <div className="blue-badge-pill">
            <span className="b-badge-icon">👨‍⚕️</span>
            <span>MALE SPECIALISTS DIRECTORY • BLUE PORTAL</span>
          </div>

          <h1 className="blue-page-title">
            Consult Top Male Doctors & Surgeons
          </h1>

          <p className="blue-page-subtitle">
            Find highly experienced male physicians and surgeons specializing in Cardiology, Orthopedics, Urology, Dermatology, Neurology, and Comprehensive Internal Medicine.
          </p>

          {/* Quick stats in blue */}
          <div className="blue-stats-row">
            <div className="blue-stat-card">
              <b>12+</b>
              <span>Senior Male Specialists</span>
            </div>
            <div className="blue-stat-card">
              <b>18,000+</b>
              <span>Consultations Completed</span>
            </div>
            <div className="blue-stat-card">
              <b>98.8%</b>
              <span>Patient Satisfaction</span>
            </div>
            <div className="blue-stat-card">
              <b>&lt; 15 min</b>
              <span>Instant Video Slots</span>
            </div>
          </div>
        </div>
      </section>

      {/* Filter and Search Bar (Themed in Blue) */}
      <section className="blue-filter-section">
        <div className="blue-filter-container">
          {/* Search box */}
          <div className="blue-search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search male doctors by name, specialty, condition, or hospital..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="clear-search-btn" onClick={() => setSearch('')}>✕</button>
            )}
          </div>

          {/* Department pills */}
          <div className="blue-pills-row">
            <span className="filter-label">Specialty:</span>
            {departments.map(dept => (
              <button
                key={dept}
                className={`blue-pill-btn ${selectedDept === dept ? 'active' : ''}`}
                onClick={() => setSelectedDept(dept)}
              >
                {dept}
              </button>
            ))}
          </div>

          {/* Secondary filter options */}
          <div className="blue-subfilters-row">
            <div className="filter-group">
              <label>Consultation Mode:</label>
              <select
                value={selectedMode}
                onChange={e => setSelectedMode(e.target.value)}
                className="blue-select"
              >
                <option value="All">All Modes (Video, Audio, Clinic)</option>
                <option value="VIDEO">Video Consultation</option>
                <option value="AUDIO">Audio Call</option>
                <option value="IN_PERSON">In-Person Clinic Visit</option>
              </select>
            </div>

            <label className="blue-checkbox-label">
              <input
                type="checkbox"
                checked={onlyToday}
                onChange={e => setOnlyToday(e.target.checked)}
              />
              <span>Available Today Only</span>
            </label>

            <span className="blue-result-count">
              Showing <strong>{filteredDoctors.length}</strong> Male Doctors
            </span>
          </div>
        </div>
      </section>

      {/* Doctors Grid */}
      <section className="blue-doctors-list-section">
        <div className="blue-list-container">
          {filteredDoctors.length === 0 ? (
            <div className="blue-empty-state">
              <span className="empty-icon">👨‍⚕️</span>
              <h3>No male doctors found matching your filters</h3>
              <p>Try clearing your search query or choosing "All" departments to see all specialists.</p>
              <button
                className="blue-primary-btn"
                onClick={() => { setSearch(''); setSelectedDept('All'); setSelectedMode('All'); setOnlyToday(false); }}
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="blue-doctors-grid">
              {filteredDoctors.map(doctor => (
                <div key={doctor.id} className="blue-doctor-card">
                  {/* Card Header */}
                  <div className="doc-card-header">
                    <div className="doc-avatar-container">
                      <div className="blue-avatar-ring">
                        {doctor.image ? (
                          <img src={doctor.image} alt={doctor.name} className="doc-avatar-img" />
                        ) : (
                          <span className="avatar-initials">
                            {doctor.name.replace(/^Dr\.\s+/, '').split(' ').map(w => w[0]).slice(0, 2).join('')}
                          </span>
                        )}
                      </div>
                      <span className="male-gender-badge" title="Male Doctor">👨‍⚕️</span>
                    </div>

                    <div className="doc-headline-info">
                      <div className="doc-dept-badge-blue">{doctor.department}</div>
                      <h3 className="doc-name-blue">{doctor.name}</h3>
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

                    {/* Key Cases / Clinical Strengths */}
                    <div className="doc-cases-box">
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
                        <span key={m} className="blue-mode-pill">
                          {m === 'VIDEO' ? '📹 Video' : m === 'AUDIO' ? '📞 Audio' : '🏥 Clinic'}
                        </span>
                      ))}
                      {doctor.availableToday && (
                        <span className="today-badge">⚡ Available Today</span>
                      )}
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
                        className="blue-book-btn"
                        onClick={() => setBookingDoctor(doctor)}
                      >
                        Book Appointment
                      </button>
                      <button
                        className="blue-second-op-btn"
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

      {/* Men's Health & Specialty Focus Spotlight */}
      <section className="blue-specialty-guide-section">
        <div className="blue-guide-container">
          <div className="blue-guide-header">
            <span className="b-guide-pill">MEN'S HEALTH & SPECIALIST CARE</span>
            <h2>Comprehensive Men's Wellness & Surgical Care</h2>
            <p>Our senior male specialists provide specialized care for cardiovascular risks, joint health, urological conditions, and lifestyle disorders.</p>
          </div>

          <div className="blue-guide-grid">
            <div className="blue-guide-card">
              <span className="guide-ic">🫀</span>
              <h4>Cardiac & Hypertension Risk</h4>
              <p>Preventive screenings, lipid profile analysis, post-stent cardiac care, and personalized hypertension protocols.</p>
            </div>
            <div className="blue-guide-card">
              <span className="guide-ic">💧</span>
              <h4>Urology & Male Wellness</h4>
              <p>Advanced laser management for kidney stones, prostate health evaluations, and confidential andrology consultations.</p>
            </div>
            <div className="blue-guide-card">
              <span className="guide-ic">🦴</span>
              <h4>Joint & Spine Rehabilitation</h4>
              <p>Joint replacement second opinions, minimally invasive arthroscopy, sports injury recovery, and sciatica management.</p>
            </div>
            <div className="blue-guide-card">
              <span className="guide-ic">✨</span>
              <h4>Dermatology & Hair Restoration</h4>
              <p>Scientifically proven protocols for male androgenetic alopecia, beard folliculitis, eczema, and psoriasis control.</p>
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
