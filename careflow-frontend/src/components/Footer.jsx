export default function Footer({ onNavigate, onOpenDashboard }) {
  return (
    <footer className="global-footer">
      <div className="footer-top-cta">
        <div className="footer-cta-container">
          <div>
            <h3>Need an immediate doctor consultation or second opinion?</h3>
            <p>Our board-certified male and female specialists are available 24/7 for video, audio, and clinic consultations.</p>
          </div>
          <div className="footer-cta-btns">
            <button className="f-cta-male" onClick={() => onNavigate('male-doctors')}>
              👨‍⚕️ Male Doctors (Blue)
            </button>
            <button className="f-cta-female" onClick={() => onNavigate('female-doctors')}>
              👩‍⚕️ Female Doctors (Pink)
            </button>
            <button className="f-cta-sec" onClick={() => onNavigate('secondary-opinion')}>
              📋 Second Opinion Desk
            </button>
          </div>
        </div>
      </div>

      <div className="footer-main">
        <div className="footer-grid">
          <div className="footer-col brand-col">
            <div className="f-logo">
              <span className="f-icon">🩺</span>
              <span className="f-name">Careflow Health</span>
            </div>
            <p className="f-desc">
              India's trusted digital health network delivering verified doctor consultations, gender-specific specialty care, and multi-disciplinary secondary medical opinions.
            </p>
            <div className="f-certifications">
              <span>🛡️ NABH Certified</span>
              <span>🔒 256-bit Encrypted</span>
              <span>✅ ABDM Integrated</span>
            </div>
          </div>

          <div className="footer-col">
            <h4>Gender-Specific Care</h4>
            <ul>
              <li><button onClick={() => onNavigate('male-doctors')}>👨‍⚕️ Male Specialists (Blue Page)</button></li>
              <li><button onClick={() => onNavigate('male-doctors')}>Men's Cardiology & Hypertension</button></li>
              <li><button onClick={() => onNavigate('male-doctors')}>Urology & Andrology Care</button></li>
              <li><button onClick={() => onNavigate('male-doctors')}>Orthopedics & Joint Replacement</button></li>
              <li><button onClick={() => onNavigate('male-doctors')}>Male Trichology & Hair Fall</button></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Women & Child Health</h4>
            <ul>
              <li><button onClick={() => onNavigate('female-doctors')}>👩‍⚕️ Female Specialists (Pink Page)</button></li>
              <li><button onClick={() => onNavigate('female-doctors')}>Gynecology & Obstetrics</button></li>
              <li><button onClick={() => onNavigate('female-doctors')}>Pediatrics & Neonatal Care</button></li>
              <li><button onClick={() => onNavigate('female-doctors')}>Endocrinology & Thyroid</button></li>
              <li><button onClick={() => onNavigate('female-doctors')}>Women's Mental Wellness</button></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Secondary Opinion & Portals</h4>
            <ul>
              <li><button onClick={() => onNavigate('secondary-opinion')}>📋 Secondary Medical Opinion</button></li>
              <li><button onClick={() => onNavigate('secondary-opinion')}>Surgery Review & Alternatives</button></li>
              <li><button onClick={() => onNavigate('secondary-opinion')}>Cancer & Cardiology Case Board</button></li>
              <li><button onClick={onOpenDashboard}>📊 Careflow Admin Dashboard</button></li>
              <li><button onClick={onOpenDashboard}>🩺 Doctor Practice Portal</button></li>
              <li><button onClick={onOpenDashboard}>👤 Patient Health Portal</button></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom-bar">
          <p>© 2026 Careflow Health Technologies Ltd. All rights reserved. For emergency life-threatening conditions, please call 112 or visit the nearest ER.</p>
          <div className="f-legal-links">
            <a href="#privacy" onClick={e => e.preventDefault()}>Privacy Policy</a>
            <span>•</span>
            <a href="#terms" onClick={e => e.preventDefault()}>Terms of Service</a>
            <span>•</span>
            <a href="#telemedicine" onClick={e => e.preventDefault()}>Telemedicine Guidelines</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
