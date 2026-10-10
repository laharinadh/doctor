import { useState, useMemo } from 'react';
import { FEMALE_DOCTORS } from '../data/doctorsData';
import BookingModal from '../components/BookingModal';
import { inr } from '../ui';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, X, User, HeartPulse, Baby, 
  Dna, Brain, Video, Phone, Building2, 
  Star, Briefcase, Languages, Clock, BadgeCheck, Stethoscope, ArrowRight
} from 'lucide-react';

// Animation variants
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, staggerChildren: 0.1 } },
  exit: { opacity: 0, y: -20 }
};

const itemVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

export default function FemaleDoctors({ initialFilter = {}, onNavigate, onOpenDashboard }) {
  const [search, setSearch] = useState(initialFilter.search || '');
  const [selectedDept, setSelectedDept] = useState(initialFilter.dept || 'All');
  const [selectedMode, setSelectedMode] = useState('All');
  const [onlyToday, setOnlyToday] = useState(false);
  const [bookingDoctor, setBookingDoctor] = useState(null);

  const departments = ['All', 'Cardiology', 'Gynecology & Obstetrics', 'Pediatrics', 'Dermatology', 'Endocrinology', 'Psychiatry', 'General Medicine', 'ENT', 'Neurology'];

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
    <motion.div 
      className="page-pink-theme"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Pink Hero Banner */}
      <section className="pink-hero-banner" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Decorative background elements */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
           <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: '300px', height: '300px', borderRadius: '50%', background: 'rgba(236, 72, 153, 0.15)', filter: 'blur(60px)' }}></div>
           <div style={{ position: 'absolute', bottom: '-10%', right: '-5%', width: '350px', height: '350px', borderRadius: '50%', background: 'rgba(219, 39, 119, 0.15)', filter: 'blur(60px)' }}></div>
        </div>

        <motion.div className="pink-banner-inner" style={{ position: 'relative', zIndex: 10 }} variants={itemVariants}>
          <div className="pink-badge-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span className="p-badge-icon" style={{ display: 'flex', alignItems: 'center' }}><User size={16} strokeWidth={2.5}/></span>
            <span>FEMALE SPECIALISTS DIRECTORY</span>
          </div>

          <h1 className="pink-page-title">
            Consult Top Female Doctors & Specialists
          </h1>

          <p className="pink-page-subtitle">
            Connect with compassionate, board-certified female physicians and surgeons across Gynecology, Pediatrics, Cardiology, Dermatology, Endocrinology, and Mental Health.
          </p>

          {/* Quick stats in pink */}
          <div className="pink-stats-row">
            {[
              { value: '14+', label: 'Senior Specialists' },
              { value: '22,000+', label: 'Consultations Delivered' },
              { value: '99.1%', label: 'Patient Satisfaction' },
              { value: '24/7', label: 'Video Slots for Emergencies' }
            ].map((stat, idx) => (
              <motion.div 
                key={idx}
                className="pink-stat-card"
                whileHover={{ scale: 1.05, translateY: -4 }}
                transition={{ duration: 0.3 }}
              >
                <b>{stat.value}</b>
                <span>{stat.label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Filter and Search Bar (Themed in Pink) */}
      <section className="pink-filter-section">
        <motion.div className="pink-filter-container" variants={itemVariants}>
          {/* Search box */}
          <div className="pink-search-box" style={{ transition: 'all 0.3s' }}>
            <span className="search-icon" style={{ display: 'flex', alignItems: 'center', color: '#94a3b8' }}>
              <Search size={20} />
            </span>
            <input
              type="text"
              placeholder="Search female doctors by name, specialty, condition, or hospital..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <AnimatePresence>
              {search && (
                <motion.button 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="clear-search-btn" 
                  onClick={() => setSearch('')}
                  style={{ display: 'flex', alignItems: 'center' }}
                >
                  <X size={18} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Department pills */}
          <div className="pink-pills-row">
            <span className="filter-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Stethoscope size={16}/> Specialty:
            </span>
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
              Showing <strong style={{ color: '#ec4899' }}>{filteredDoctors.length}</strong> Female Doctors
            </span>
          </div>
        </motion.div>
      </section>

      {/* Doctors Grid */}
      <section className="pink-doctors-list-section" style={{ position: 'relative', zIndex: 10 }}>
        <div className="pink-list-container">
          {filteredDoctors.length === 0 ? (
            <motion.div 
              className="pink-empty-state"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <span className="empty-icon" style={{ display: 'inline-flex', color: '#ec4899', opacity: 0.8 }}>
                <Search size={64} strokeWidth={1.5} />
              </span>
              <h3>No female doctors found matching your filters</h3>
              <p>Try clearing your search query or choosing "All" departments to see all specialists.</p>
              <button
                className="pink-primary-btn"
                onClick={() => { setSearch(''); setSelectedDept('All'); setSelectedMode('All'); setOnlyToday(false); }}
              >
                Reset Filters
              </button>
            </motion.div>
          ) : (
            <motion.div 
              className="pink-doctors-grid"
              variants={pageVariants}
              initial="initial"
              animate="animate"
            >
              {filteredDoctors.map(doctor => (
                <motion.div key={doctor.id} className="pink-doctor-card" variants={itemVariants} whileHover={{ translateY: -4, boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)' }} style={{ transition: 'all 0.3s' }}>
                  {/* Card Header */}
                  <div className="doc-card-header">
                    <div className="doc-avatar-container">
                      <div className="pink-avatar-ring">
                        {doctor.image ? (
                          <img src={doctor.image} alt={doctor.name} className="doc-avatar-img" />
                        ) : (
                          <span className="avatar-initials">
                            {doctor.name.replace(/^Dr\.\s+/, '').split(' ').map(w => w[0]).slice(0, 2).join('')}
                          </span>
                        )}
                      </div>
                      <span className="female-gender-badge" title="Female Doctor" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ec4899' }}>
                        <User size={14} strokeWidth={2.5}/>
                      </span>
                    </div>

                    <div className="doc-headline-info">
                      <div className="doc-dept-badge-pink">{doctor.department}</div>
                      <h3 className="doc-name-pink">{doctor.name}</h3>
                      <p className="doc-title-sub">{doctor.title}</p>
                      <div className="doc-meta-row">
                        <span className="meta-exp" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Briefcase size={14} /> {doctor.experience} yrs exp
                        </span>
                        <span className="meta-rating" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Star size={14} fill="currentColor" /> {doctor.rating} ({doctor.reviews} reviews)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Body Info */}
                  <div className="doc-body-info">
                    <div className="doc-qualification" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <BadgeCheck size={16} color="#ec4899" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div><strong>Qualification:</strong> {doctor.qualification}</div>
                    </div>
                    <div className="doc-hospital" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <Building2 size={16} color="#ec4899" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div><strong>Affiliation:</strong> {doctor.hospital}</div>
                    </div>
                    <div className="doc-reg" style={{ paddingLeft: '24px' }}>
                      <small style={{ opacity: 0.7 }}>Reg. No: {doctor.registration_no}</small>
                    </div>

                    <p className="doc-about-text" style={{ margin: '12px 0' }}>{doctor.about}</p>

                    {/* Key Cases */}
                    <div className="doc-cases-box pink-cases">
                      <strong style={{ color: '#fbcfe8' }}>Clinical Highlights:</strong>
                      <ul style={{ listStyle: 'none', paddingLeft: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {doctor.cases.map((c, i) => (
                          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                            <ArrowRight size={14} color="#ec4899" style={{ flexShrink: 0, marginTop: '4px' }} />
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Consultation Modes */}
                    <div className="doc-modes-tags" style={{ marginTop: '16px' }}>
                      {doctor.modes.map(m => (
                        <span key={m} className="pink-mode-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {m === 'VIDEO' ? <Video size={12}/> : m === 'AUDIO' ? <Phone size={12}/> : <Building2 size={12}/>}
                          {m === 'VIDEO' ? 'Video' : m === 'AUDIO' ? 'Audio' : 'Clinic'}
                        </span>
                      ))}
                      {doctor.availableToday && (
                        <span className="today-badge pink-today" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12}/> Available Today
                        </span>
                      )}
                    </div>

                    {/* Languages */}
                    <div className="doc-lang-row" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Languages size={14} /> 
                      <small>Languages: {doctor.languages.join(', ')}</small>
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
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </section>

      {/* Women's & Children's Health Spotlight */}
      <section className="pink-specialty-guide-section" style={{ position: 'relative', zIndex: 10 }}>
        <motion.div className="pink-guide-container" variants={itemVariants}>
          <div className="pink-guide-header" style={{ textAlign: 'center', marginBottom: '40px' }}>
            <span className="p-guide-pill" style={{ display: 'inline-block', marginBottom: '16px' }}>WOMEN'S & CHILDREN'S HEALTH</span>
            <h2>Comprehensive Women's Wellness & Child Care</h2>
            <p style={{ maxWidth: '700px', margin: '0 auto', fontSize: '18px', color: '#cbd5e1' }}>
              Our leading female specialists bring deep empathy and clinical excellence to maternal health, hormonal therapies, pediatric care, and women's mental wellness.
            </p>
          </div>

          <div className="pink-guide-grid">
            {[
              {
                icon: <HeartPulse color="#ec4899" size={32} />,
                title: "Gynecology & Obstetrics",
                desc: "High-risk pregnancies, PCOS & PCOD management, fibroid evaluations, hormonal wellness, and safe deliveries."
              },
              {
                icon: <Baby color="#ec4899" size={32} />,
                title: "Pediatrics & Neonatology",
                desc: "Newborn care, immunization schedules, child growth monitoring, childhood infections, and allergy management."
              },
              {
                icon: <Dna color="#ec4899" size={32} />,
                title: "Endocrinology & Thyroid",
                desc: "Thyroid dysfunction, gestational diabetes, osteoporosis management, metabolic syndrome, and insulin resistance."
              },
              {
                icon: <Brain color="#ec4899" size={32} />,
                title: "Mental Health & Psychiatry",
                desc: "Postpartum depression, anxiety disorders, burnout recovery, insomnia therapy, and compassionate cognitive care."
              }
            ].map((guide, idx) => (
              <motion.div 
                key={idx}
                className="pink-guide-card"
                whileHover={{ y: -5, background: 'rgba(255, 255, 255, 0.1)' }}
                style={{ transition: 'background 0.3s' }}
              >
                <div style={{ marginBottom: '16px' }}>{guide.icon}</div>
                <h4>{guide.title}</h4>
                <p>{guide.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Booking Modal */}
      <AnimatePresence>
        {bookingDoctor && (
          <BookingModal
            doctor={bookingDoctor}
            onClose={() => setBookingDoctor(null)}
            onBookSuccess={() => {}}
            onOpenDashboard={onOpenDashboard}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
