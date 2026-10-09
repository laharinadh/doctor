import { useState } from 'react';
import { auth } from '../api';
import { toast } from '../ui';

const NAMES = { admin: 'OTP Admin', doctor: 'Dr. Ananya Rao', patient: 'Rahul Menon' };

export default function LoginRegister({ onDone, onBack }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [isFirebaseSent, setIsFirebaseSent] = useState(false);

  const handleGoHome = () => {
    if (onBack) {
      onBack();
    } else {
      window.location.href = '/';
    }
  };

  const run = async fn => { setBusy(true); try { await fn(); } catch (e) { toast(e.message); } setBusy(false); };
  
  const send = () => run(async () => {
    const res = await auth.sendOtp(phone);
    if (res?.firebase) {
      setIsFirebaseSent(true);
    } else {
      setIsFirebaseSent(false);
    }
    setStep(1);
    toast(res?.message || 'Verification code sent!');
  });
  
  const verify = () => run(async () => {
    const r = await auth.verify(phone, otp);
    const u = r.user || r;
    const prof = r.profile || {};
    onDone({
      token: r.token || r.accessToken,
      role: String(u.role || 'PATIENT').toLowerCase(),
      name: prof.name || u.name || u.full_name || phone,
      phone: u.phone || phone,
      userId: u.id || 1,
    });
  });

  return (
    <div className="login-page-wrapper" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(170deg, #0b0d11 0%, #131929 55%, #1a1035 100%)', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '440px', background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '24px', padding: '36px', boxShadow: '0 24px 64px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column' }}>
        
        {/* Top Back Action Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <button
            type="button"
            onClick={step === 1 ? () => setStep(0) : handleGoHome}
            aria-label="Back"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '10px',
              color: '#d1d9e6',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff'; }}
            onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#d1d9e6'; }}
          >
            <span style={{ fontSize: '15px' }}>←</span> {step === 1 ? 'Change Phone' : 'Back to Home'}
          </button>

          {step === 1 && (
            <button
              type="button"
              onClick={handleGoHome}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#8e9caa',
                fontSize: '13px',
                cursor: 'pointer',
                padding: '4px 8px',
                textDecoration: 'underline'
              }}
              onMouseOver={e => e.currentTarget.style.color = '#fff'}
              onMouseOut={e => e.currentTarget.style.color = '#8e9caa'}
            >
              Back to Home
            </button>
          )}
        </div>

        {/* Brand */}
        <div 
          onClick={handleGoHome} 
          role="button" 
          tabIndex={0} 
          title="Back to Home"
          style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', justifyContent: 'center', cursor: 'pointer' }}
        >
          <span style={{ fontSize: '28px' }}>🩺</span>
          <span style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '2px', background: 'linear-gradient(135deg, #64e5d2, #4dacff)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>OTP</span>
        </div>

        <h2 style={{ margin: '0 0 12px', fontSize: '24px', fontWeight: 800, color: '#fff', textAlign: 'center' }}>
          Welcome
        </h2>
        
        {step === 0 ? <>
          <p style={{ color: '#9aabbd', fontSize: '14px', lineHeight: 1.6, textAlign: 'center', marginBottom: '28px' }}>
            Enter your phone number to receive a one-time code. We'll create an account for you if you don't have one.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input 
              aria-label="Phone number" 
              placeholder="e.g. 98765 43210" 
              value={phone} 
              onChange={e => setPhone(e.target.value)} 
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', padding: '16px 20px', color: '#fff', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = '#4dacff'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
            <button 
              disabled={busy || phone.length < 8} 
              onClick={send} 
              style={{ width: '100%', background: busy || phone.length < 8 ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #4dacff, #1d5fd1)', color: busy || phone.length < 8 ? '#6d7686' : '#fff', border: 'none', borderRadius: '12px', padding: '16px', fontWeight: 700, fontSize: '15px', cursor: busy || phone.length < 8 ? 'not-allowed' : 'pointer', transition: 'opacity 0.2s', opacity: (busy || phone.length < 8) ? 0.7 : 1 }}
            >
              {busy ? 'Sending code...' : 'Continue'}
            </button>
          </div>
        </> : <>
          <p style={{ color: '#9aabbd', fontSize: '14px', lineHeight: 1.6, textAlign: 'center', marginBottom: '28px' }}>
            We've sent a 6-digit code to <b style={{ color: '#fff' }}>{phone}</b>.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input 
              aria-label="One-time code" 
              inputMode="numeric" 
              placeholder="Enter 6-digit code" 
              value={otp} 
              onChange={e => setOtp(e.target.value)} 
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', padding: '16px 20px', color: '#fff', fontSize: '15px', outline: 'none', boxSizing: 'border-box', textAlign: 'center', letterSpacing: '4px', fontWeight: 700 }}
              onFocus={e => e.target.style.borderColor = '#4dacff'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
            {isFirebaseSent ? (
              <div style={{ background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.25)', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', color: '#34d399', textAlign: 'center' }}>
                💬 <b>Firebase SMS Sent:</b> Please check your messages.
              </div>
            ) : null}
            <button 
              disabled={busy || !otp} 
              onClick={verify} 
              style={{ width: '100%', background: busy || !otp ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #64e5d2, #4dacff)', color: busy || !otp ? '#6d7686' : '#fff', border: 'none', borderRadius: '12px', padding: '16px', fontWeight: 800, fontSize: '15px', cursor: busy || !otp ? 'not-allowed' : 'pointer', transition: 'transform 0.2s', boxShadow: busy || !otp ? 'none' : '0 8px 20px rgba(77, 172, 255, 0.2)' }}
            >
              {busy ? 'Verifying...' : 'Verify & Sign In'}
            </button>
          </div>
        </>}
        
        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '32px 0 24px' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
          <span style={{ padding: '0 12px', fontSize: '12px', color: '#6d7686', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Or explore demo</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {['admin', 'doctor', 'patient'].map(r => (
            <button 
              key={r} 
              onClick={() => onDone({ demo: true, role: r, name: NAMES[r] })} 
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#aab1be', padding: '10px 0', borderRadius: '10px', fontSize: '13px', fontWeight: 600, textTransform: 'capitalize', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseOver={e => { e.target.style.background = 'rgba(255,255,255,0.08)'; e.target.style.color = '#fff'; }}
              onMouseOut={e => { e.target.style.background = 'rgba(255,255,255,0.04)'; e.target.style.color = '#aab1be'; }}
            >
              {r}
            </button>
          ))}
        </div>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={handleGoHome}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8e9caa',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'color 0.2s',
            }}
            onMouseOver={e => e.currentTarget.style.color = '#4dacff'}
            onMouseOut={e => e.currentTarget.style.color = '#8e9caa'}
          >
            ← Return to Home Page
          </button>
        </div>
      </div>
    </div>
  );
}
