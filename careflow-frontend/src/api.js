import { useEffect, useState } from 'react';
import { hasFirebasePhoneSession, sendFirebasePhoneOtp, verifyFirebasePhoneOtp } from './firebase';

export const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export const session = {
  get: () => { try { return JSON.parse(localStorage.getItem('cf')); } catch { return null; } },
  set: v => {
    try {
      localStorage.setItem('cf', JSON.stringify(v));
      window.dispatchEvent(new CustomEvent('session-updated', { detail: v }));
    } catch {}
  },
  clear: () => {
    try {
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
      const code = fbErr?.code ? ` (${fbErr.code})` : '';
      throw new Error(`Firebase could not send the SMS${code}. Check that Phone provider is enabled and this domain is authorized.`);
    }
  },
  verify: async (phone, otp, name) => {
    const formatted = formatPhone(phone);
    // If Firebase confirmation result is active on window, verify via Firebase Phone Auth
    if (hasFirebasePhoneSession()) {
      try {
        const fbRes = await verifyFirebasePhoneOtp(otp);
        // Firebase SMS OTP successfully verified! Authenticate with backend using verified ID token
        return await call('POST', '/auth/verify-otp', {
          phone: formatted,
          phone_number: formatted,
          idToken: fbRes.idToken,
          name,
          role: 'PATIENT',
        });
      } catch (fbVerifyErr) {
        console.error('Firebase code verification failed:', fbVerifyErr);
        throw new Error('The verification code is invalid or expired. Request a new code and try again.');
      }
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
