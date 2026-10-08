import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

export const firebaseConfig = {
  apiKey: "AIzaSyCsyQx1yo7Yw0b6V-tRw5Uh3TjSf56Ozhg",
  authDomain: "doctor-23ff6.firebaseapp.com",
  projectId: "doctor-23ff6",
  storageBucket: "doctor-23ff6.firebasestorage.app",
  messagingSenderId: "281726036257",
  appId: "1:281726036257:web:0cd690631431a75d323660",
  measurementId: "G-BWV2X0FSRB"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);

let confirmationResult = null;
let recaptchaVerifier = null;

/**
 * Setup or reset Invisible reCAPTCHA verifier
 */
export function getOrCreateRecaptcha(containerId = 'recaptcha-container') {
  if (typeof window === 'undefined') return null;

  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch (e) {}
  }

  let el = document.getElementById(containerId);
  if (!el) {
    el = document.createElement('div');
    el.id = containerId;
    document.body.appendChild(el);
  }

  recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, containerId, {
    size: 'invisible',
    callback: () => {
      // reCAPTCHA solved - allow SMS dispatch
    },
    'expired-callback': () => {
      confirmationResult = null;
      recaptchaVerifier = null;
    },
  });

  return recaptchaVerifier;
}

/**
 * Triggers real-time SMS OTP to recipient phone number using Firebase Phone Auth
 */
export async function sendFirebasePhoneOtp(phoneNumber, containerId = 'recaptcha-container') {
  if (!/^\+[1-9]\d{7,14}$/.test(phoneNumber)) {
    throw new Error('Enter a valid phone number with country code, for example +919876543210.');
  }

  const verifier = getOrCreateRecaptcha(containerId);
  try {
    confirmationResult = await signInWithPhoneNumber(firebaseAuth, phoneNumber, verifier);
    return confirmationResult;
  } catch (error) {
    confirmationResult = null;
    try { verifier.clear(); } catch (e) {}
    recaptchaVerifier = null;
    throw error;
  }
}

/**
 * Verifies the real SMS OTP code sent to user phone and returns Firebase ID Token
 */
export async function verifyFirebasePhoneOtp(code) {
  if (!confirmationResult) {
    throw new Error('No active verification session. Please request OTP first.');
  }
  if (!/^\d{6}$/.test(String(code).trim())) {
    throw new Error('Enter the 6-digit verification code from the SMS.');
  }
  const result = await confirmationResult.confirm(String(code).trim());
  const user = result.user;
  const idToken = await user.getIdToken();
  confirmationResult = null;
  return {
    user,
    idToken,
    phoneNumber: user.phoneNumber,
  };
}

export function hasFirebasePhoneSession() {
  return Boolean(confirmationResult);
}
