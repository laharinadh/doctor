# Careflow frontend

React + Vite dashboards (admin, doctor, patient) for the backend at
[laharinadh/doctor](https://github.com/laharinadh/doctor).

## Run

```bash
cp .env.example .env     # set VITE_API_URL (default http://localhost:3000/api/v1)
npm install
npm run dev              # http://localhost:5173
npm run build            # production build in dist/
```

Allow `http://localhost:5173` in the backend's CORS settings.

## Modes

- **Sign in** with phone and OTP. This calls `POST /auth/send-otp` and `POST /auth/verify-otp`
  and keeps the returned token. Adjust `auth` in `src/api.js` if your response shape differs.
- **Sample data**: the buttons on the sign-in screen open each role with built-in data.
  Any page whose API call fails also falls back to sample data and shows a notice.

## Where things live

| File | Purpose |
| --- | --- |
| `src/api.js` | fetch client, token storage, `useData` hook, Razorpay loader |
| `src/App.jsx` | sign-in, sidebar navigation per role |
| `src/pages/admin.jsx` | dashboard, doctors, patients, departments, appointments, payments, settings, audit logs |
| `src/pages/doctor.jsx` | queue, schedule, profile and verification |
| `src/pages/patient.jsx` | home, find doctors and book, appointments, medical records |

Endpoints for patients, appointments and payments under `/admin` are not in the README
of the backend; add them there or change the paths in `admin.jsx`.
