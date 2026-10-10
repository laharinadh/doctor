import { useEffect, useState } from 'react';
import { hasFirebasePhoneSession, sendFirebasePhoneOtp, verifyFirebasePhoneOtp } from './firebase';

export const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export const session = {
  // sessionStorage survives refreshes but is cleared automatically when this tab closes.
  get: () => { try { return JSON.parse(sessionStorage.getItem('cf')); } catch { return null; } },
  set: v => {
    try {
      sessionStorage.setItem('cf', JSON.stringify(v));
      window.dispatchEvent(new CustomEvent('session-updated', { detail: v }));
    } catch {}
  },
  clear: () => {
    try {
      sessionStorage.removeItem('cf');
      localStorage.removeItem('cf');
      window.dispatchEvent(new CustomEvent('session-updated', { detail: null }));
    } catch {}
  },
};
export const demo = () => !!session.get()?.demo;

export async function call(method, path, body) {
  const s = session.get();
  const form = body instanceof FormData;
  const headers = {
    ...(form || !body ? {} : { 'Content-Type': 'application/json' }),
    ...(s?.token ? { Authorization: 'Bearer ' + s.token } : {}),
  };
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: form ? body : body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.message || j.error || res.statusText);
  return j.data ?? j;
}

// Writes are skipped in demo mode; the page updates its local copy instead.
export const act = (m, p, b) => (demo() ? Promise.resolve() : call(m, p, b));

  // Loads sample data only for an explicit demo session.
export function useData(path, mock) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let live = true;
    setD(null); setErr('');
    (demo() ? Promise.resolve(mock) : call('GET', path))
      .then(x => live && setD(x))
      .catch(e => { if (live) { setErr(e.message); setD(null); } });
    return () => { live = false; };
  }, [path]);
  return [d, setD, err];
}

export function formatPhone(phone) {
  if (!phone) return '';
  const cleaned = String(phone).trim().replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.length === 10) return '+91' + cleaned;
  return '+' + cleaned;
}

export const auth = {
  sendOtp: async phone => {
    const formatted = formatPhone(phone);
    try {
      await sendFirebasePhoneOtp(formatted);
      return {
        firebase: true,
        phone: formatted,
        message: `Real-time Firebase SMS OTP sent to ${formatted}!`,
      };
    } catch (fbErr) {
      console.error('Firebase Phone Auth could not send OTP:', fbErr);
      const messages = {
        'auth/operation-not-allowed': 'Phone sign-in is disabled in Firebase Authentication. Enable the Phone provider.',
        'auth/unauthorized-domain': 'This website domain is not authorized in Firebase Authentication. Add localhost or the current host under Authorized domains.',
        'auth/invalid-api-key': 'The Firebase web API key is invalid or belongs to a different project.',
        'auth/captcha-check-failed': 'reCAPTCHA verification failed. Refresh the page and try again.',
        'auth/too-many-requests': 'Firebase temporarily blocked requests from this device. Wait and try again later.',
        'auth/quota-exceeded': 'Firebase SMS quota has been exceeded for this project.',
        'auth/invalid-phone-number': 'Enter a valid phone number with country code, for example +919989916085.',
      };
      const code = fbErr?.code || 'unknown-error';
      throw new Error(messages[code] || `Firebase could not send the SMS (${code}). Check Firebase Phone provider and Authorized domains.`);
    }
  },
  verify: async (phone, otp, name) => {
    const formatted = formatPhone(phone);
    // If Firebase confirmation result is active on window, verify via Firebase Phone Auth
    if (hasFirebasePhoneSession()) {
      let fbRes;
      try {
        fbRes = await verifyFirebasePhoneOtp(otp);
      } catch (fbVerifyErr) {
        console.error('Firebase code verification failed:', fbVerifyErr);
        const code = fbVerifyErr?.code || 'invalid-code';
        throw new Error(code === 'auth/invalid-verification-code' || code === 'auth/code-expired'
          ? 'The verification code is invalid or expired. Request a new code and try again.'
          : `Firebase verification failed (${code}). Refresh the page and request a new code.`);
      }
      // Firebase SMS successfully verified; exchange the Firebase ID token for the application session.
      return await call('POST', '/auth/verify-otp', {
        phone: formatted,
        phone_number: formatted,
        idToken: fbRes.idToken,
        name,
        role: 'PATIENT',
      });
    }

    // Direct backend verification if no active Firebase confirmation session
    return await call('POST', '/auth/verify-otp', {
      phone: formatted,
      phone_number: formatted,
      otp,
      idToken: otp,
      name,
      role: 'PATIENT',
    });
  },
};

export function loadRazorpay() {
  return new Promise((ok, no) => {
    if (window.Razorpay) return ok();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = ok; s.onerror = () => no(new Error('Could not load Razorpay'));
    document.body.appendChild(s);
  });
}
