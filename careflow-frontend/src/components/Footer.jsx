export default function Footer({ onNavigate }) {
  const go = page => onNavigate?.(page);

  return (
    <footer className="global-footer">
      <div className="footer-top-cta">
        <div className="footer-cta-container">
          <div className="footer-cta-copy">
            <span className="footer-eyebrow">CARE THAT FITS YOUR LIFE</span>
            <h3>Find the right doctor for your next step.</h3>
            <p>Explore trusted specialists, compare care options, and book a consultation when you’re ready.</p>
          </div>
          <div className="footer-cta-btns">
            <button className="f-cta-primary" onClick={() => go('male-doctors')}>Find a specialist <span>↗</span></button>
            <button className="f-cta-secondary" onClick={() => go('secondary-opinion')}>Get a second opinion</button>
          </div>
        </div>
      </div>

      <div className="footer-main">
        <div className="footer-grid">
          <div className="footer-col brand-col">
            <div className="f-logo">
              <span className="f-icon">🩺</span>
              <span className="f-name">Careflow <em>CARE</em></span>
            </div>
            <p className="f-desc">
              A calmer way to find trusted doctors, understand your options, and take care of what matters.
            </p>
            <div className="footer-contact-card">
              <span className="footer-contact-icon">✦</span>
              <span><small>Need help choosing?</small><a href="tel:18002273356">1800-CARE-FLOW</a></span>
            </div>
          </div>

          <div className="footer-col">
            <h4>Explore care</h4>
            <ul>
              <li><button onClick={() => go('male-doctors')}>Male doctors</button></li>
              <li><button onClick={() => go('female-doctors')}>Female doctors</button></li>
              <li><button onClick={() => go('male-doctors')}>Browse specialties</button></li>
              <li><button onClick={() => go('secondary-opinion')}>Second opinions</button></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Popular specialties</h4>
            <ul>
              <li><button onClick={() => go('male-doctors')}>Cardiology</button></li>
              <li><button onClick={() => go('male-doctors')}>Dermatology</button></li>
              <li><button onClick={() => go('female-doctors')}>Gynecology</button></li>
              <li><button onClick={() => go('female-doctors')}>Pediatrics</button></li>
            </ul>
          </div>

          <div className="footer-col footer-trust-col">
            <h4>Why Careflow</h4>
            <div className="footer-trust-list">
              <span><b>01</b> Verified specialists</span>
              <span><b>02</b> Flexible consultations</span>
              <span><b>03</b> Clear next steps</span>
            </div>
          </div>
        </div>

        <div className="footer-bottom-bar">
          <p>© 2026 Careflow Health Technologies Ltd. For emergencies, call 112.</p>
          <div className="f-legal-links">
            <a href="#privacy">Privacy</a>
            <span>•</span>
            <a href="#terms">Terms</a>
            <span>•</span>
            <a href="#telemedicine">Telemedicine</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
