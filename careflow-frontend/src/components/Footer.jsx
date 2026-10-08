export default function Footer({ onNavigate, onOpenDashboard }) {
  return (
    <footer className="global-footer">
      <div className="footer-top-cta">
        <div className="footer-cta-container">
          <div>
            <h3>Need an immediate doctor consultation?</h3>
            <p>Our board-certified specialists are available 24/7 for video, audio, and clinic consultations.</p>
          </div>
          <div className="footer-cta-btns">
            <button className="f-cta-male" onClick={onOpenDashboard}>
              Open Portal Dashboard
            </button>
          </div>
        </div>
      </div>

      <div className="footer-main">
        <div className="footer-grid">
          <div className="footer-col brand-col">
            <div className="f-logo">
              <span className="f-icon">🩺</span>
              <span className="f-name">OTP Health</span>
            </div>
            <p className="f-desc">
              India's trusted digital health network delivering verified doctor consultations, specialty care, and multi-disciplinary medical opinions.
            </p>
            <div className="f-certifications">
              <span>🛡️ NABH Certified</span>
              <span>🔒 256-bit Encrypted</span>
              <span>✅ ABDM Integrated</span>
            </div>
          </div>

          <div className="footer-col">
            <h4>Medical Care</h4>
            <ul>
              <li><button onClick={onOpenDashboard}>Cardiology & Hypertension</button></li>
              <li><button onClick={onOpenDashboard}>Orthopedics & Joint Replacement</button></li>
              <li><button onClick={onOpenDashboard}>Gynecology & Obstetrics</button></li>
              <li><button onClick={onOpenDashboard}>Pediatrics & Neonatal Care</button></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Portals</h4>
            <ul>
              <li><button onClick={onOpenDashboard}>📊 OTP Admin Dashboard</button></li>
              <li><button onClick={onOpenDashboard}>🩺 Doctor Practice Portal</button></li>
              <li><button onClick={onOpenDashboard}>👤 Patient Health Portal</button></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom-bar">
          <p>© 2026 OTP Health Technologies Ltd. All rights reserved. For emergency life-threatening conditions, please call 112 or visit the nearest ER.</p>
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
