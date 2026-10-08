import { useState, useEffect } from 'react';
import { inr, toast } from '../ui';
import { session, auth, call, loadRazorpay, demo } from '../api';

export default function BookingModal({ doctor, onClose, onBookSuccess, defaultMode = 'VIDEO', onOpenDashboard }) {
  const currentSession = session.get();
  const isAuthenticated = Boolean(currentSession?.token || currentSession?.demo);

  // Steps: 'auth' | 'details' | 'payment' | 'confirmed'
  const [step, setStep] = useState(isAuthenticated ? 'details' : 'auth');
  const [sessionUser, setSessionUser] = useState(currentSession);

  // Auth form state
  const [authName, setAuthName] = useState(currentSession?.name || '');
  const [authPhone, setAuthPhone] = useState(currentSession?.phone || '');
  const [authOtp, setAuthOtp] = useState('');
  const [realtimeOtp, setRealtimeOtp] = useState('');
  const [isFirebaseSent, setIsFirebaseSent] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');

  // Booking details state
  const [mode, setMode] = useState(doctor?.modes?.includes(defaultMode) ? defaultMode : doctor?.modes?.[0] || 'VIDEO');
  const [selectedDate, setSelectedDate] = useState(0); // 0 = today, 1 = tomorrow, 2 = day after
  const [selectedSlot, setSelectedSlot] = useState(doctor?.slots?.[0] || '10:00 AM');
  const [notes, setNotes] = useState('');

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [payBusy, setPayBusy] = useState(false);
  const [platformFee] = useState(99); // ₹99 Platform Booking Fee

  // Confirmation state
  const [refId, setRefId] = useState('');
  const [platformFeeReceipt, setPlatformFeeReceipt] = useState('');

  if (!doctor) return null;

  const dates = [
    {
      label: 'Today',
      sub: new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      iso: new Date().toISOString().split('T')[0],
    },
    {
      label: 'Tomorrow',
      sub: new Date(Date.now() + 864e5).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      iso: new Date(Date.now() + 864e5).toISOString().split('T')[0],
    },
    {
      label: new Date(Date.now() + 2 * 864e5).toLocaleDateString('en-IN', { weekday: 'short' }),
      sub: new Date(Date.now() + 2 * 864e5).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      iso: new Date(Date.now() + 2 * 864e5).toISOString().split('T')[0],
    },
  ];

  /* ─────────────────────────────────────────────────────────────
     AUTH HANDLERS (STEP 1)
     ───────────────────────────────────────────────────────────── */
  const handleSendOtp = async (e) => {
    e?.preventDefault();
    setAuthError('');
    const cleanPhone = authPhone.trim();
    if (!cleanPhone || cleanPhone.length < 8) {
      setAuthError('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!authName.trim()) {
      setAuthError('Please enter the patient full name to register');
      return;
    }

    setAuthBusy(true);
    try {
      const res = await auth.sendOtp(cleanPhone);
      setOtpSent(true);
      if (res?.firebase) {
        setIsFirebaseSent(true);
        setRealtimeOtp('');
      } else {
        setIsFirebaseSent(false);
        if (res?.otp) setRealtimeOtp(res.otp);
      }
      toast(res?.message || 'Verification code sent!');
    } catch (err) {
      setAuthError(err.message || 'Failed to send verification code. Please check your number.');
      toast(err.message || 'Failed to send OTP');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    setAuthError('');
    if (!authOtp.trim() || authOtp.length < 4) {
      setAuthError('Please enter the 6-digit verification code');
      return;
    }

    setAuthBusy(true);
    try {
      const res = await auth.verify(authPhone.trim(), authOtp.trim(), authName.trim());
      const u = res.user || res;
      const profile = res.profile || {};
      const newSession = {
        token: res.token || res.accessToken,
        userId: u.id || 1,
        role: String(u.role || 'PATIENT').toLowerCase(),
        name: profile.name || authName.trim() || u.phone,
        phone: u.phone || authPhone.trim(),
      };
      session.set(newSession);
      setSessionUser(newSession);
      setStep('details');
      toast(`Welcome, ${newSession.name}! Account verified.`);
    } catch (err) {
      setAuthError(err.message || 'Could not verify the code. Please try again.');
      toast(err.message || 'Could not verify OTP');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleQuickDemoPatient = () => {
    const demoUser = {
      demo: true,
      role: 'patient',
      name: 'Rahul Verma',
      phone: '+91 91234 56780',
      userId: 1,
    };
    session.set(demoUser);
    setSessionUser(demoUser);
    setAuthName(demoUser.name);
    setAuthPhone(demoUser.phone);
    setStep('details');
    toast('Signed in as Demo Patient (Rahul Verma)');
  };

  const handleSignOutOrSwitch = () => {
    session.clear();
    setSessionUser(null);
    setOtpSent(false);
    setAuthOtp('');
    setStep('auth');
    toast('Signed out. Please sign in or register to continue.');
  };

  /* ─────────────────────────────────────────────────────────────
     SLOT DETAILS HANDLER (STEP 2)
     ───────────────────────────────────────────────────────────── */
  const handleProceedToPayment = (e) => {
    e.preventDefault();
    if (!selectedSlot) {
      toast('Please choose a consultation time slot');
      return;
    }
    setStep('payment');
  };

  /* ─────────────────────────────────────────────────────────────
     PLATFORM FEE PAYMENT HANDLER (STEP 3)
     Mandatory platform fee paid BEFORE doctor appointment is confirmed
     ───────────────────────────────────────────────────────────── */
  const handlePayPlatformFee = async () => {
    setPayBusy(true);

    const targetDate = dates[selectedDate].iso;
    let appointmentNum;
    let receiptNum;

    try {
      if (!sessionUser?.token || sessionUser?.demo) {
        throw new Error('Please sign in with a verified phone number before paying.');
      }

      // 1. Lock/Hold appointment slot
      const ap = await call('POST', '/patient/appointments', {
            doctorId: doctor.id || 1,
            doctor_id: doctor.id || 1,
            appointmentDate: targetDate,
            date: targetDate,
            startTime: selectedSlot,
            start_time: selectedSlot,
            consultationMode: mode,
            mode: mode,
            notes,
      });

      if (ap?.appointment_number) appointmentNum = ap.appointment_number;
      const apId = ap.id;
      if (!apId) throw new Error('Appointment could not be created.');

      // 2. Create platform fee payment order
      const order = await call('POST', '/payments/create-order', {
        appointmentId: apId,
        appointment_id: apId,
      });

      await loadRazorpay();
      const rzpOrderId = order?.orderId || order?.order_id;
      const rzpKey = order?.keyId || order?.key_id || import.meta.env.VITE_RAZORPAY_KEY;
      if (!rzpOrderId || !rzpKey || !window.Razorpay) throw new Error('Online payment is not configured.');

      await new Promise((resolve, reject) => {
        const checkout = new window.Razorpay({
          key: rzpKey,
          order_id: rzpOrderId,
          amount: order.amount,
          currency: order.currency || 'INR',
          name: 'Careflow',
          handler: async response => {
            try {
              await call('POST', '/payments/verify', { ...response, appointmentId: apId, appointment_id: apId });
              resolve(response);
            } catch (error) { reject(error); }
          },
        });
        checkout.on('payment.failed', response => reject(new Error(response.error?.description || 'Payment failed')));
        checkout.open();
      });

      receiptNum = `PAY_RZP_${rzpOrderId.slice(-6).toUpperCase()}`;

      // Successful platform fee payment
      setRefId(appointmentNum);
      setPlatformFeeReceipt(receiptNum);
      setStep('confirmed');
      toast(`₹${platformFee} Platform fee paid successfully! Appointment confirmed.`);

      if (onBookSuccess) {
        onBookSuccess({
          id: appointmentNum,
          doctor: doctor.name,
          date: dates[selectedDate].sub,
          time: selectedSlot,
          mode,
          platformFee,
          doctorFee: doctor.fee,
          patient: sessionUser?.name || authName,
          receipt: receiptNum,
        });
      }
    } catch (err) {
      toast(err.message || 'Payment processing failed. Please try again.');
    } finally {
      setPayBusy(false);
    }
  };

  const handleDownloadPass = () => {
    const text = `
========================================
       CAREFRAME HEALTHCARE PASS
========================================
Appointment ID   : ${refId}
Doctor           : ${doctor.name} (${doctor.department})
Hospital         : ${doctor.hospital || 'Careflow Health Network'}
Date & Time      : ${dates[selectedDate].sub}, ${selectedSlot}
Consultation Mode: ${mode}
Patient Name     : ${sessionUser?.name || authName}
Patient Phone    : ${sessionUser?.phone || authPhone}
----------------------------------------
Platform Fee     : Rs. ${platformFee} (PAID - ${platformFeeReceipt})
Doctor Fee       : Rs. ${doctor.fee} (Due at consultation / visit)
Payment Status   : VERIFIED & CONFIRMED
========================================
Please arrive 10 minutes prior or ensure high-speed internet for video visit.
Emergency Support: +91 800-CAREFREE
    `.trim();

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Careflow-Booking-${refId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Booking pass downloaded!');
  };

  const handleOpenPortal = () => {
    onClose();
    if (onOpenDashboard) {
      onOpenDashboard();
    }
  };

  const isMale = doctor.gender === 'male';
  const themeClass = isMale ? 'modal-blue' : 'modal-pink';

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className={`modal-box ${themeClass}`} onClick={e => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose} aria-label="Close dialog">✕</button>

        {/* ── Multi-Step Progress Tracker ── */}
        <div className="modal-stepper">
          <div className={`stepper-step ${step === 'auth' ? 'active' : 'done'}`}>
            <span className="stepper-circle">{step === 'auth' ? '1' : '✓'}</span>
            <span>1. Sign In</span>
          </div>
          <div className={`stepper-line ${step !== 'auth' ? 'done' : ''}`} />

          <div className={`stepper-step ${step === 'details' ? 'active' : step === 'payment' || step === 'confirmed' ? 'done' : ''}`}>
            <span className="stepper-circle">{step === 'payment' || step === 'confirmed' ? '✓' : '2'}</span>
            <span>2. Slot</span>
          </div>
          <div className={`stepper-line ${step === 'payment' || step === 'confirmed' ? 'done' : ''}`} />

          <div className={`stepper-step ${step === 'payment' ? 'active' : step === 'confirmed' ? 'done' : ''}`}>
            <span className="stepper-circle">{step === 'confirmed' ? '✓' : '3'}</span>
            <span>3. Pay Fee</span>
          </div>
          <div className={`stepper-line ${step === 'confirmed' ? 'done' : ''}`} />

          <div className={`stepper-step ${step === 'confirmed' ? 'active done' : ''}`}>
            <span className="stepper-circle">{step === 'confirmed' ? '✓' : '4'}</span>
            <span>4. Confirmed</span>
          </div>
        </div>

        {/* ── Doctor Header Summary (Shown on Steps 1, 2, 3) ── */}
        {step !== 'confirmed' && (
          <div className="modal-header">
            <div className="modal-doc-avatar">
              {isMale ? '👨‍⚕️' : '👩‍⚕️'}
            </div>
            <div>
              <span className="modal-sub-tag">{doctor.department}</span>
              <h3 className="modal-title">{doctor.name}</h3>
              <p className="modal-doc-desc">{doctor.qualification} • {doctor.experience} yrs exp</p>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            STEP 1: AUTHENTICATION GATE (SIGN IN OR REGISTER)
            ───────────────────────────────────────────────────────────── */}
        {step === 'auth' && (
          <div className="modal-auth-container">
            <div className="modal-auth-intro">
              <h4>Sign In or Register to Continue</h4>
              <p>Please enter your details to reserve an appointment with {doctor.name}.</p>
            </div>

            {authError && (
              <div style={{ color: '#d32f2f', fontSize: 12, background: 'rgba(211,47,47,.08)', padding: '8px 12px', borderRadius: 6 }}>
                ⚠️ {authError}
              </div>
            )}

            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="auth-input-group">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="f-lbl">Patient Full Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={authName}
                    onChange={e => setAuthName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="f-lbl">Mobile Number (+91) *</label>
                  <input
                    type="tel"
                    placeholder="98765 43210"
                    value={authPhone}
                    onChange={e => setAuthPhone(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="confirm-btn" disabled={authBusy} style={{ width: '100%', marginTop: 6 }}>
                  {authBusy ? 'Sending verification code...' : 'Send Verification OTP →'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="auth-otp-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--mu)' }}>Code sent to <b>{authPhone}</b></span>
                  <button type="button" className="btn-back-link" onClick={() => setOtpSent(false)}>Change</button>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="f-lbl">Enter 6-Digit OTP Code *</label>
                  {isFirebaseSent ? (
                    <div style={{ background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.25)', borderRadius: 8, padding: '8px 12px', margin: '4px 0 10px', fontSize: 12 }}>
                      💬 <b>Firebase SMS Sent:</b> Enter the 6-digit verification SMS code received on <b>{authPhone}</b>.
                    </div>
                  ) : realtimeOtp ? (
                    <div style={{ background: 'rgba(29,95,209,.08)', border: '1px solid rgba(29,95,209,.2)', borderRadius: 8, padding: '8px 12px', margin: '4px 0 10px', fontSize: 12 }}>
                      📲 <b>Verification Code:</b> <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: '#1d5fd1', letterSpacing: 2 }}>{realtimeOtp}</span>
                      <small style={{ display: 'block', color: 'var(--mu)', marginTop: 2 }}>Sent to {authPhone} (valid for 5 mins).</small>
                    </div>
                  ) : null}
                  <input
                    type="text"
                    maxLength="6"
                    placeholder="Enter 6-digit code"
                    value={authOtp}
                    onChange={e => setAuthOtp(e.target.value)}
                    autoFocus
                    required
                  />
                  <small style={{ fontSize: 10.5, color: 'var(--mu)', marginTop: 4, display: 'block' }}>
                    💡 Code valid for 5 minutes. Enter code to confirm and book.
                  </small>
                </div>

                <button type="submit" className="confirm-btn" disabled={authBusy} style={{ width: '100%' }}>
                  {authBusy ? 'Verifying account...' : 'Verify & Continue to Booking →'}
                </button>

                <div style={{ textAlign: 'center' }}>
                  <button type="button" className="btn-back-link" onClick={handleSendOtp} disabled={authBusy}>
                    Resend code
                  </button>
                </div>
              </form>
            )}

            <div className="demo-auth-divider">or quick evaluation</div>

            <button type="button" className="quick-demo-btn" onClick={handleQuickDemoPatient}>
              <span>⚡ 1-Click Patient Sign-in (Demo Patient)</span>
            </button>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            STEP 2: APPOINTMENT DETAILS & SLOT SELECTION
            ───────────────────────────────────────────────────────────── */}
        {step === 'details' && (
          <div>
            {/* Signed-in patient badge */}
            <div className="modal-session-bar">
              <div className="modal-session-info">
                <span>✓</span>
                <span>Booking as: <b>{sessionUser?.name || authName}</b> ({sessionUser?.phone || authPhone})</span>
              </div>
              <button type="button" className="modal-session-switch" onClick={handleSignOutOrSwitch}>
                Switch
              </button>
            </div>

            <form onSubmit={handleProceedToPayment}>
              {/* Consultation Mode */}
              <div className="form-group">
                <label className="f-lbl">1. Select Consultation Mode</label>
                <div className="mode-selector">
                  {doctor.modes.map(m => {
                    const icon = m === 'VIDEO' ? '📹' : m === 'AUDIO' ? '📞' : '🏥';
                    const name = m === 'VIDEO' ? 'Video Visit' : m === 'AUDIO' ? 'Phone Visit' : 'Clinic Visit';
                    return (
                      <button
                        type="button"
                        key={m}
                        className={`mode-btn ${mode === m ? 'selected' : ''}`}
                        onClick={() => setMode(m)}
                      >
                        <span className="m-ic">{icon}</span>
                        <span className="m-name">{name}</span>
                        <span className="m-fee">{inr(doctor.fee)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date selection */}
              <div className="form-group">
                <label className="f-lbl">2. Select Date</label>
                <div className="date-selector">
                  {dates.map((d, idx) => (
                    <button
                      type="button"
                      key={d.label}
                      className={`date-pill ${selectedDate === idx ? 'selected' : ''}`}
                      onClick={() => setSelectedDate(idx)}
                    >
                      <b>{d.label}</b>
                      <span>{d.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Slots */}
              <div className="form-group">
                <label className="f-lbl">3. Select Available Slot ({dates[selectedDate].label})</label>
                <div className="slot-grid">
                  {doctor.slots.map(slot => (
                    <button
                      type="button"
                      key={slot}
                      className={`slot-chip ${selectedSlot === slot ? 'selected' : ''}`}
                      onClick={() => setSelectedSlot(slot)}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              {/* Patient Notes */}
              <div className="form-group">
                <label className="f-lbl">4. Health Concern / Symptoms (Optional)</label>
                <textarea
                  rows="2"
                  placeholder="Describe current symptoms or chief health complaint..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              {/* Footer action */}
              <div className="modal-footer">
                <div className="footer-fee">
                  <small>Platform Fee Due Now</small>
                  <b>{inr(platformFee)}</b>
                </div>
                <button type="submit" className="confirm-btn">
                  Proceed to Platform Fee Payment →
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            STEP 3: PLATFORM FEE PAYMENT (MANDATORY BEFORE BOOKING)
            ───────────────────────────────────────────────────────────── */}
        {step === 'payment' && (
          <div className="platform-fee-container">
            <button type="button" className="btn-back-link" onClick={() => setStep('details')}>
              ← Back to Slot Selection
            </button>

            {/* Platform Fee Transparent Breakdown */}
            <div className="platform-fee-callout">
              <div className="pfee-title-row">
                <span className="pfee-title">Platform Booking & Slot Lock Fee</span>
                <span className="pfee-badge">Required Prior to Booking</span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--mu)', lineHeight: 1.45 }}>
                To secure your consultation and guarantee Dr. {doctor.name}’s exclusive time,
                a platform reservation fee of ₹{platformFee} is paid now.
              </p>

              <div className="pfee-table">
                <div className="pfee-row">
                  <span>Platform Booking Fee (Holds Slot)</span>
                  <b>{inr(platformFee)}</b>
                </div>
                <div className="pfee-row">
                  <span>Doctor Consultation Fee (Paid at Clinic / Visit)</span>
                  <span style={{ color: 'var(--mu)' }}>{inr(doctor.fee)}</span>
                </div>
                <div className="pfee-row total">
                  <span>Total Payable Right Now</span>
                  <b style={{ color: '#1d5fd1', fontSize: 16 }}>{inr(platformFee)}</b>
                </div>
              </div>
            </div>

            {/* Key Guarantees */}
            <div className="pfee-guarantees">
              <div className="pfee-guarantee-item">
                <span>🛡️</span>
                <span><b>100% Refundable:</b> Cancel up to 2 hours prior to slot for an instant refund.</span>
              </div>
              <div className="pfee-guarantee-item">
                <span>⚡</span>
                <span><b>Instant Slot Lock:</b> Concurrency protection prevents double booking.</span>
              </div>
              <div className="pfee-guarantee-item">
                <span>📲</span>
                <span><b>Direct Pass:</b> Meeting link and SMS sent upon fee payment verification.</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="f-lbl">Select Payment Method</label>
              <div className="payment-methods-strip">
                {['UPI', 'Card', 'Netbanking'].map(m => (
                  <button
                    type="button"
                    key={m}
                    className={`pay-method-pill ${paymentMethod === m ? 'active' : ''}`}
                    onClick={() => setPaymentMethod(m)}
                  >
                    {m === 'UPI' ? '📱 UPI / QR' : m === 'Card' ? '💳 Cards' : '🏦 Netbanking'}
                  </button>
                ))}
              </div>
            </div>

            {/* Pay Button */}
            <div className="modal-footer" style={{ marginTop: 0 }}>
              <div className="footer-fee">
                <small>Amount Due Now</small>
                <b>{inr(platformFee)}</b>
              </div>
              <button
                type="button"
                className="confirm-btn"
                disabled={payBusy}
                onClick={handlePayPlatformFee}
              >
                {payBusy ? 'Processing Payment...' : `Pay ${inr(platformFee)} Platform Fee & Book →`}
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            STEP 4: APPOINTMENT CONFIRMED (DIGITAL PASS)
            ───────────────────────────────────────────────────────────── */}
        {step === 'confirmed' && (
          <div className="booking-success-box">
            <div className="success-icon-badge">✓</div>
            <h3>Appointment Confirmed!</h3>
            <p className="success-sub">
              Your platform fee is verified and your consultation with {doctor.name} is scheduled.
            </p>

            <div className="ticket-card">
              <div className="ticket-row">
                <span>Appointment Ref</span>
                <b style={{ color: '#1d5fd1' }}>{refId}</b>
              </div>
              <div className="ticket-row">
                <span>Doctor</span>
                <b>{doctor.name}</b>
              </div>
              <div className="ticket-row">
                <span>Department</span>
                <span>{doctor.department}</span>
              </div>
              <div className="ticket-row">
                <span>Date & Time</span>
                <b>{dates[selectedDate].sub}, {selectedSlot}</b>
              </div>
              <div className="ticket-row">
                <span>Consultation Mode</span>
                <span className="ticket-mode-pill">{mode}</span>
              </div>
              <div className="ticket-row">
                <span>Patient</span>
                <span>{sessionUser?.name || authName}</span>
              </div>
              <div className="ticket-row">
                <span>Platform Fee</span>
                <span style={{ color: '#2e7d32', fontWeight: 700 }}>{inr(platformFee)} (PAID • {platformFeeReceipt})</span>
              </div>
              <div className="ticket-row total">
                <span>Doctor Consultation Fee</span>
                <b>{inr(doctor.fee)} <small style={{ fontWeight: 400, color: 'var(--mu)', fontSize: 11 }}>(Paid at visit)</small></b>
              </div>
            </div>

            <p className="instructions-note">
              📩 SMS confirmation & meeting link sent to {sessionUser?.phone || authPhone}.
              The session will be active 10 minutes prior to your slot.
            </p>

            <div className="success-actions">
              <button className="confirm-btn" onClick={handleOpenPortal} style={{ background: '#2e7d32' }}>
                Open in Patient Portal →
              </button>
              <button className="sec-outline-btn" onClick={handleDownloadPass}>
                Download Pass
              </button>
              <button className="sec-outline-btn" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
