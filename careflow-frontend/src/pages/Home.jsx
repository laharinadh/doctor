import { useState } from 'react';
import { MALE_DOCTORS, FEMALE_DOCTORS, SPECIALTIES, SECOND_OPINION_SPECIALISTS } from '../data/doctorsData';
import BookingModal from '../components/BookingModal';
import { inr } from '../ui';

export default function Home({ onNavigate, onOpenDashboard }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoctorForBooking, setSelectedDoctorForBooking] = useState(null);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    onOpenDashboard();
  };

  const topMale = MALE_DOCTORS.slice(0, 2);
  const topFemale = FEMALE_DOCTORS.slice(0, 2);

  return (
    <div className="home-page-container">
      {/* Hero Section */}
      <section className="home-hero-section">
        <div className="hero-content-wrapper">
          <div className="hero-badge">
            <span className="h-badge-icon">🏥</span>
            <span>Comprehensive Digital Health & Second Opinion Platform</span>
          </div>

          <h1 className="hero-main-title">
            Consult Verified <span className="blue-gradient-text">Expert</span> Doctors On-Demand
          </h1>

          <p className="hero-subtext">
            Connect instantly with top medical specialists for personalized care, accurate diagnoses, and trusted healthcare solutions.
          </p>

          {/* Search bar */}
          <form className="hero-search-form" onSubmit={handleSearchSubmit}>
            <div className="search-input-group">
              <span className="s-icon">🔍</span>
              <input
                type="text"
                placeholder="Search by doctor name, specialty (Cardiology, Gynecology, Orthopedics)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="hero-search-btn">
              Find Specialist →
            </button>
          </form>

          {/* Trust stats pill */}
          <div className="hero-trust-strip">
            <div className="trust-item">
              <span className="t-icon">⭐</span>
              <div>
                <b>4.9 / 5.0 Rating</b>
                <small>25,000+ patient visits</small>
              </div>
            </div>
            <div className="trust-divider" />
            <div className="trust-item">
              <span className="t-icon">⏱️</span>
              <div>
                <b>&lt; 15 Mins Wait</b>
                <small>Instant audio/video slots</small>
              </div>
            </div>
            <div className="trust-divider" />
            <div className="trust-item">
              <span className="t-icon">🛡️</span>
              <div>
                <b>100% Verified</b>
                <small>MCI & State Council certified</small>
              </div>
            </div>
          </div>
        </div>
      </section>



      {/* Featured Specialties Grid */}
      <section id="specialties" className="home-specialties-section">
        <div className="section-header-centered">
          <span className="section-subtitle">CLINICAL EXCELLENCE</span>
          <h2>Explore by Specialty</h2>
          <p>Find dedicated male and female specialists across our primary medical departments.</p>
        </div>

        <div className="specialties-grid">
          {SPECIALTIES.map(s => (
            <div key={s.name} className="specialty-card">
              <div className="spec-icon">{s.icon}</div>
              <h4>{s.name}</h4>
              <p>{s.desc}</p>
              <div className="spec-gender-links">
                {s.maleCount > 0 && (
                  <button
                    className="spec-tag blue"
                    onClick={() => onNavigate('male-doctors', { dept: s.name })}
                  >
                    👨‍⚕️ Male Docs ({s.maleCount})
                  </button>
                )}
                {s.femaleCount > 0 && (
                  <button
                    className="spec-tag pink"
                    onClick={() => onNavigate('female-doctors', { dept: s.name })}
                  >
                    👩‍⚕️ Female Docs ({s.femaleCount})
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Spotlight Doctors Showcase: Both Male and Female */}
      <section className="home-spotlight-section">
        <div className="section-header-row">
          <div>
            <span className="section-subtitle">TOP RATED PRACTITIONERS</span>
            <h2>Featured Specialists Ready to Consult</h2>
          </div>
          <div className="spotlight-quick-links">
            <button className="spotlight-btn-male" onClick={() => onNavigate('male-doctors')}>
              View All Male Doctors (Blue) →
            </button>
            <button className="spotlight-btn-female" onClick={() => onNavigate('female-doctors')}>
              View All Female Doctors (Pink) →
            </button>
          </div>
        </div>

        <div className="spotlight-grid">
          {/* Male Spotlight 1 */}
          {topMale.map(doc => (
            <div key={doc.id} className="spotlight-doc-card doc-card-blue">
              <div className="card-top-gender-badge badge-blue">🩺 {doc.department} Specialist</div>
              <div className="s-doc-header">
                <div className="s-doc-avatar blue-av">
                  <span>{doc.name.split(' ').map(w => w[0]).slice(1, 3).join('')}</span>
                </div>
                <div>
                  <h4>{doc.name}</h4>
                  <span className="doc-dept-pill">{doc.department}</span>
                  <div className="doc-rating">
                    <span className="star">★</span> {doc.rating} ({doc.reviews} reviews)
                  </div>
                </div>
              </div>
              <p className="doc-about-short">{doc.about}</p>
              <div className="doc-details-row">
                <span>Exp: <strong>{doc.experience} yrs</strong></span>
                <span>Fee: <strong>{inr(doc.fee)}</strong></span>
              </div>
              <div className="doc-card-actions">
                <button
                  className="book-btn-blue"
                  onClick={() => setSelectedDoctorForBooking(doc)}
                  style={{ width: '100%' }}
                >
                  Book Appointment
                </button>
              </div>
            </div>
          ))}

          {/* Female Spotlight 1 */}
          {topFemale.map(doc => (
            <div key={doc.id} className="spotlight-doc-card doc-card-pink">
              <div className="card-top-gender-badge badge-pink">🩺 {doc.department} Specialist</div>
              <div className="s-doc-header">
                <div className="s-doc-avatar pink-av">
                  <span>{doc.name.split(' ').map(w => w[0]).slice(1, 3).join('')}</span>
                </div>
                <div>
                  <h4>{doc.name}</h4>
                  <span className="doc-dept-pill">{doc.department}</span>
                  <div className="doc-rating">
                    <span className="star">★</span> {doc.rating} ({doc.reviews} reviews)
                  </div>
                </div>
              </div>
              <p className="doc-about-short">{doc.about}</p>
              <div className="doc-details-row">
                <span>Exp: <strong>{doc.experience} yrs</strong></span>
                <span>Fee: <strong>{inr(doc.fee)}</strong></span>
              </div>
              <div className="doc-card-actions">
                <button
                  className="book-btn-pink"
                  onClick={() => setSelectedDoctorForBooking(doc)}
                  style={{ width: '100%' }}
                >
                  Book Appointment
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Secondary Opinion Feature Showcase */}
      <section className="home-second-opinion-banner">
        <div className="second-op-container">
          <div className="second-op-text">
            <span className="sec-op-badge">📋 SECONDARY OPINION DESK</span>
            <h2>Why Risk an Uncertain Diagnosis or Unnecessary Surgery?</h2>
            <p>
              Up to 20% of major surgical recommendations can be safely treated with conservative or alternative management. Our senior review board analyzes your MRIs, pathology, and past prescriptions to deliver absolute peace of mind.
            </p>
            <div className="second-op-checks">
              <div>✓ Multi-specialist independent audit</div>
              <div>✓ Video debrief with lead consultant</div>
              <div>✓ Turnaround within 24 to 48 hours</div>
              <div>✓ Secure HIPAA-compliant document vault</div>
            </div>
            <div className="second-op-actions">
              <button
                className="second-op-primary-btn"
                onClick={() => onNavigate('secondary-opinion')}
              >
                Submit Reports for Second Opinion →
              </button>
            </div>
          </div>

          <div className="second-op-board-preview">
            <h4>Senior Medical Review Board</h4>
            <div className="reviewers-list">
              {SECOND_OPINION_SPECIALISTS.map(spec => (
                <div key={spec.name} className="reviewer-mini-card">
                  <div className="rev-avatar">{spec.gender === 'male' ? '👨‍⚕️' : '👩‍⚕️'}</div>
                  <div className="rev-info">
                    <b>{spec.name}</b>
                    <small>{spec.specialty}</small>
                    <span className="rev-cases">★ {spec.casesReviewed}+ case reviews</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it Works: 3 Steps */}
      <section className="home-how-it-works">
        <div className="section-header-centered">
          <span className="section-subtitle">SIMPLE & SEAMLESS</span>
          <h2>How OTP Works</h2>
          <p>Get top-tier medical care or second opinions in 3 simple steps.</p>
        </div>

        <div className="how-steps-grid">
          <div className="how-step-card">
            <div className="step-num">1</div>
            <h4>Choose Your Doctor</h4>
            <p>Select between male or female doctors by specialty, qualification, experience, and patient ratings.</p>
          </div>
          <div className="how-step-card">
            <div className="step-num">2</div>
            <h4>Select Slot or Upload Files</h4>
            <p>Pick a convenient video/clinic slot or upload clinical scans for a secondary medical opinion.</p>
          </div>
          <div className="how-step-card">
            <div className="step-num">3</div>
            <h4>Consult & Receive Plan</h4>
            <p>Connect with your doctor, receive verified e-prescriptions, and access your follow-up care in your portal.</p>
          </div>
        </div>
      </section>

      {/* Portal Gateway Banner: Connect to existing OTP Dashboard */}
      <section className="portal-callout-section">
        <div className="portal-callout-card">
          <div className="portal-callout-info">
            <span className="portal-badge">📊 ENTERPRISE HEALTH SUITE</span>
            <h3>Access the OTP Portal & Dashboard</h3>
            <p>
              Are you an Admin managing clinic operations, a Doctor viewing patient consultations, or a Patient tracking prescriptions and medical history?
            </p>
          </div>
          <div className="portal-callout-btns">
            <button className="portal-enter-btn" onClick={onOpenDashboard}>
              Open Dashboard Portal →
            </button>
          </div>
        </div>
      </section>

      {/* Booking Modal */}
      {selectedDoctorForBooking && (
        <BookingModal
          doctor={selectedDoctorForBooking}
          onClose={() => setSelectedDoctorForBooking(null)}
          onBookSuccess={() => { }}
          onOpenDashboard={onOpenDashboard}
        />
      )}
    </div>
  );
}
