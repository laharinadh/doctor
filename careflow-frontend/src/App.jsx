import { useEffect, useState } from 'react';
import { session, auth } from './api';
import { toast } from './ui';
import { adminPages } from './pages/admin';
import { doctorPages } from './pages/doctor';
import { patientPages } from './pages/patient';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import MaleDoctors from './pages/MaleDoctors';
import FemaleDoctors from './pages/FemaleDoctors';
import SecondaryOpinion from './pages/SecondaryOpinion';

const NAV = {
  admin: [['Overview', [['dash', 'Dashboard']]], ['Manage', [['docs', 'Doctors'], ['pats', 'Patients'], ['depts', 'Departments']]], ['Operations', [['apps', 'Appointments'], ['pay', 'Payments']]], ['System', [['set', 'Settings'], ['log', 'Audit logs']]]],
  doctor: [['Overview', [['dash', 'Dashboard']]], ['Practice', [['apps', 'Appointments'], ['cons', 'Consultations'], ['pats', 'Patients'], ['recs', 'Medical records']]], ['Availability', [['sched', 'Schedule and leave']]], ['Account', [['prof', 'Profile'], ['ver', 'Verification'], ['notif', 'Notifications']]]],
  patient: [['Overview', [['dash', 'Home']]], ['Care', [['find', 'Find doctors'], ['apps', 'Appointments']]], ['Health', [['recs', 'Medical records'], ['pay', 'Payments']]], ['Account', [['prof', 'Profile'], ['notif', 'Notifications']]]],
};
const PAGES = { admin: adminPages, doctor: doctorPages, patient: patientPages };
const NAMES = { admin: 'Careflow Admin', doctor: 'Dr. Ananya Rao', patient: 'Rahul Menon' };

function Login({ onDone }) {
  const [phone, setPhone] = useState(''), [otp, setOtp] = useState(''), [step, setStep] = useState(0), [busy, setBusy] = useState(false);
  const [realtimeOtp, setRealtimeOtp] = useState('');
  const [isFirebaseSent, setIsFirebaseSent] = useState(false);
  const run = async fn => { setBusy(true); try { await fn(); } catch (e) { toast(e.message); } setBusy(false); };
  const send = () => run(async () => {
    const res = await auth.sendOtp(phone);
    if (res?.firebase) {
      setIsFirebaseSent(true);
      setRealtimeOtp('');
    } else {
      setIsFirebaseSent(false);
      if (res?.otp) setRealtimeOtp(res.otp);
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
    <div className="login"><div className="card">
      <div className="logo" style={{ color: 'var(--tx)', padding: 0 }}>Careflow <em>CARE</em></div>
      <h2>Sign in</h2>
      {step === 0 ? <>
        <p>Enter your phone number to get a one-time code.</p>
        <input aria-label="Phone number" placeholder="98765 43210" value={phone} onChange={e => setPhone(e.target.value)} />
        <button className="qb pri" disabled={busy || phone.length < 8} onClick={send}>
          {busy ? 'Sending code...' : 'Send code'}
        </button>
      </> : <>
        <p>Enter the code sent to {phone}.</p>
        <input aria-label="One-time code" inputMode="numeric" placeholder="6-digit code" value={otp} onChange={e => setOtp(e.target.value)} />
        {isFirebaseSent ? (
          <div style={{ background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.25)', borderRadius: 8, padding: '8px 12px', margin: '6px 0 12px', fontSize: 12 }}>
            💬 <b>Firebase SMS Sent:</b> Enter the 6-digit verification SMS sent directly to <b>{phone}</b>.
          </div>
        ) : realtimeOtp ? (
          <div style={{ background: 'rgba(29,95,209,.08)', border: '1px solid rgba(29,95,209,.2)', borderRadius: 8, padding: '8px 12px', margin: '6px 0 12px', fontSize: 12 }}>
            📲 <b>Real-time OTP Code:</b> <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: '#1d5fd1', letterSpacing: 2 }}>{realtimeOtp}</span>
            <small style={{ display: 'block', color: 'var(--mu)', marginTop: 2 }}>Valid for 5 minutes. Enter this code to verify.</small>
          </div>
        ) : null}
        <button className="qb pri" disabled={busy || !otp} onClick={verify}>
          {busy ? 'Verifying...' : 'Verify and continue'}
        </button>
      </>}
      <p style={{ textAlign: 'center' }}>or explore with sample data</p>
      <div className="qa" style={{ margin: 0, justifyContent: 'center' }}>
        {['admin', 'doctor', 'patient'].map(r => <button key={r} className="qb" onClick={() => onDone({ demo: true, role: r, name: NAMES[r] })} style={{ textTransform: 'capitalize' }}>{r}</button>)}
      </div>
    </div></div>
  );
}

/* ─── Dashboard Shell (existing admin / doctor / patient portal) ─── */
function DashboardShell({ s, setS, page, setPage, k, setK }) {
  const Page = PAGES[s.role][page] || PAGES[s.role].dash;
  const title = NAV[s.role].flatMap(g => g[1]).find(x => x[0] === page)?.[1] || 'Dashboard';
  const swap = r => { const v = { ...s, role: r, name: NAMES[r] }; session.set(v); setS(v); setPage('dash'); };

  return (
    <div className="shell" data-role={s.role}>
      <aside className="side">
        <div className="logo">Careflow <em>CARE</em></div>
        <nav aria-label="Main">
          {NAV[s.role].map(([g, items]) => <div key={g}><div className="grp">{g}</div>{items.map(([id, label]) =>
            <button key={id} aria-current={page === id} onClick={() => setPage(id)}>{label}</button>)}</div>)}
        </nav>
      </aside>
      <div className="main">
        <header className="top">
          <h1>{title}</h1>
          {s.demo && <select aria-label="Switch role" style={{ width: 110 }} value={s.role} onChange={e => swap(e.target.value)}><option value="admin">Admin</option><option value="doctor">Doctor</option><option value="patient">Patient</option></select>}
          <button className="sm" onClick={() => setK(k + 1)}>Refresh</button>
          <div className="av">{s.name?.[0] || 'U'}</div>
          <div className="who">{s.name}<small style={{ textTransform: 'capitalize' }}>{s.role}</small></div>
          <button className="sm" onClick={() => { session.clear(); setS(null); }}>Sign out</button>
        </header>
        <main className="page"><Page key={page + k} go={setPage} user={s} /></main>
      </div>
    </div>
  );
}

/* ─── Main App – Multi-Page Router ─── */
export default function App() {
  const [s, setS] = useState(session.get());
  const [page, setPage] = useState('dash'), [k, setK] = useState(0), [msg, setMsg] = useState('');

  // Multi-page state: 'home' | 'male-doctors' | 'female-doctors' | 'secondary-opinion' | 'dashboard'
  const [multiPage, setMultiPage] = useState('home');
  const [multiPageFilter, setMultiPageFilter] = useState({});

  useEffect(() => {
    const h = e => { setMsg(e.detail); clearTimeout(h.t); h.t = setTimeout(() => setMsg(''), 2400); };
    window.addEventListener('toast', h); return () => window.removeEventListener('toast', h);
  }, []);

  useEffect(() => {
    const handleSession = e => setS(e.detail);
    window.addEventListener('session-updated', handleSession);
    return () => window.removeEventListener('session-updated', handleSession);
  }, []);

  const done = v => { session.set(v); setS(v); setPage('dash'); setMultiPage('dashboard'); };

  const navigateMultiPage = (pageId, filter = {}) => {
    setMultiPageFilter(filter);
    setMultiPage(pageId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openDashboard = () => {
    if (s) {
      setMultiPage('dashboard');
    } else {
      setMultiPage('login');
    }
  };

  // Determine what to render
  const renderPage = () => {
    switch (multiPage) {
      case 'home':
        return <Home onNavigate={navigateMultiPage} onOpenDashboard={openDashboard} />;
      case 'male-doctors':
        return <MaleDoctors initialFilter={multiPageFilter} onNavigate={navigateMultiPage} onOpenDashboard={openDashboard} />;
      case 'female-doctors':
        return <FemaleDoctors initialFilter={multiPageFilter} onNavigate={navigateMultiPage} onOpenDashboard={openDashboard} />;
      case 'secondary-opinion':
        return <SecondaryOpinion onNavigate={navigateMultiPage} onOpenDashboard={openDashboard} />;
      case 'login':
        return <><Login onDone={done} />{msg && <div className="toast" role="status">{msg}</div>}</>;
      case 'dashboard':
        if (!s) return <><Login onDone={done} />{msg && <div className="toast" role="status">{msg}</div>}</>;
        return <DashboardShell s={s} setS={setS} page={page} setPage={setPage} k={k} setK={setK} />;
      default:
        return <Home onNavigate={navigateMultiPage} onOpenDashboard={openDashboard} />;
    }
  };

  const isDashboardView = multiPage === 'dashboard' && s;
  const isLoginView = multiPage === 'login' || (multiPage === 'dashboard' && !s);

  return (
    <>
      {/* Show Navbar on public multi-pages, hide on dashboard/login */}
      {!isDashboardView && !isLoginView && (
        <Navbar
          activePage={multiPage}
          onNavigate={navigateMultiPage}
          onOpenDashboard={openDashboard}
          sessionUser={s}
        />
      )}

      {renderPage()}

      {/* Show Footer on public multi-pages, hide on dashboard/login */}
      {!isDashboardView && !isLoginView && (
        <Footer onNavigate={navigateMultiPage} onOpenDashboard={openDashboard} />
      )}

      {msg && !isLoginView && <div className="toast" role="status">{msg}</div>}
    </>
  );
}
