import { useEffect, useState } from 'react';
import { Card, Stat, Chip, Table, toast, inr } from '../ui';
import { useData, act, call, demo, loadRazorpay, BASE, session } from '../api';
import InstantCall from '../components/InstantCall';

const FEE = 99;
const day = n => new Date(Date.now() + n * 864e5);
const iso = d => d.toISOString().slice(0, 10);
const fmt = d => (typeof d === 'string' ? new Date(d + 'T00:00') : d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const list = x => (Array.isArray(x) ? x : x?.items || []);
const nm = x => x?.name || x;
const MODE = { VIDEO: 'Video', AUDIO: 'Audio', IN_PERSON: 'In person' };
const ini = n => String(n).replace(/^Dr\.? /, '').split(' ').map(w => w[0]).slice(0, 2).join('');
const normalizeDoctor = d => ({
  ...d,
  department: d.department || d.department_name || d.specialty || 'General Medicine',
  experience: Number(d.experience ?? d.experience_years ?? 0),
  fee: Number(d.fee ?? d.consultation_fee ?? 0),
  registration_no: d.registration_no || d.registration_number || '',
  qualification: d.qualification || 'Qualification not provided',
  about: d.about || d.bio || 'Care available by appointment.',
  rating: d.rating ?? 0,
  reviews: d.reviews ?? 0,
  // The current schema does not store doctor-specific modes, so expose the
  // modes supported by the appointment API until that capability is added.
  modes: d.modes?.length ? d.modes : ['VIDEO', 'AUDIO', 'IN_PERSON'],
});

const D = {
  depts: ['Cardiology', 'Dermatology', 'ENT', 'General Medicine', 'Gynecology', 'Neurology', 'Orthopedics', 'Pediatrics'],
  docs: [
    { id: 1, name: 'Dr. Ananya Rao', department: 'Cardiology', experience: 12, fee: 600, rating: 4.9, reviews: 212, qualification: 'MBBS, MD (Cardiology)', registration_no: 'MCI-40137', modes: ['VIDEO', 'AUDIO', 'IN_PERSON'], about: 'Heart health, blood pressure and preventive cardiology.', cases: ['Managed 300+ hypertension cases', 'Led a cardiac rehabilitation programme'] },
    { id: 2, name: 'Dr. Vikram Shah', department: 'Dermatology', experience: 8, fee: 450, rating: 4.7, reviews: 148, qualification: 'MBBS, MD (Dermatology)', registration_no: 'MCI-40274', modes: ['VIDEO', 'IN_PERSON'], about: 'Acne, eczema and long-term skin care.', cases: ['Treated 500+ chronic acne patients'] },
    { id: 3, name: 'Dr. Meera Iyer', department: 'Pediatrics', experience: 15, fee: 500, rating: 4.9, reviews: 305, qualification: 'MBBS, DCH, MD (Pediatrics)', registration_no: 'APMC-61822', modes: ['VIDEO', 'AUDIO', 'IN_PERSON'], about: 'Child growth, vaccination and common infections.', cases: ['Newborn care clinic lead'] },
    { id: 4, name: 'Dr. Kiran Reddy', department: 'Neurology', experience: 10, fee: 800, rating: 4.8, reviews: 97, qualification: 'MBBS, DM (Neurology)', registration_no: 'TSMC-30987', modes: ['VIDEO', 'IN_PERSON'], about: 'Migraine, epilepsy and nerve conditions.', cases: ['Migraine management programme'] },
    { id: 5, name: 'Dr. Rajesh Sharma', department: 'General Medicine', experience: 16, fee: 500, rating: 4.9, reviews: 342, qualification: 'MBBS, MD (General Medicine), MRCP', registration_no: 'MCI-38910', modes: ['VIDEO', 'AUDIO', 'IN_PERSON'], about: 'Senior consultant physician specializing in preventive healthcare.', cases: ['Managed 5,000+ patient health checkups'] },
    { id: 6, name: 'Dr. Arvind Nair', department: 'Orthopedics', experience: 14, fee: 650, rating: 4.8, reviews: 219, qualification: 'MBBS, MS (Ortho), MCh Joint Arthroplasty', registration_no: 'KMC-52119', modes: ['VIDEO', 'IN_PERSON'], about: 'Joint replacements, arthroscopy, and spine care.', cases: ['2,800+ successful joint surgeries'] },
    { id: 7, name: 'Dr. Pooja Sen', department: 'Gynecology', experience: 14, fee: 650, rating: 4.9, reviews: 388, qualification: 'MBBS, MS (OBG), FICOG', registration_no: 'WBMC-61022', modes: ['VIDEO', 'AUDIO', 'IN_PERSON'], about: 'High-risk pregnancies and laparoscopic care.', cases: ['3,500+ safe deliveries'] },
    { id: 8, name: 'Dr. Kavita Joshi', department: 'ENT', experience: 7, fee: 600, rating: 4.8, reviews: 165, qualification: 'MS (ENT), DLO, Head & Neck Specialist', registration_no: 'MCI-88128', modes: ['VIDEO', 'IN_PERSON'], about: 'Ear, Nose & Throat clinical care.', cases: ['Specialist in endoscopic sinus surgeries'] },
    { id: 9, name: 'Dr. Harish Nambiar', department: 'Pediatrics', experience: 14, fee: 600, rating: 4.9, reviews: 240, qualification: 'MBBS, DCH, MD (Pediatrics), FIAP', registration_no: 'MCI-88123', modes: ['VIDEO', 'AUDIO', 'IN_PERSON'], about: 'Child health, immunization, growth & newborn care.', cases: ['Over 10,000 pediatric consultations'] },
  ],
  slots: ['09:00', '09:30', '10:00', '10:30', '11:30', '12:00', '12:30'],
  apps: [
    { id: 92, doctor: 'Dr. Ananya Rao', date: iso(day(0)), time: '16:30', mode: 'VIDEO', status: 'CONFIRMED' },
    { id: 91, doctor: 'Dr. Meera Iyer', date: iso(day(1)), time: '11:00', mode: 'VIDEO', status: 'CONFIRMED' },
    { id: 90, doctor: 'Dr. Ananya Rao', date: iso(day(-6)), time: '10:00', mode: 'IN_PERSON', status: 'COMPLETED' },
    { id: 89, doctor: 'Dr. Vikram Shah', date: iso(day(-12)), time: '12:00', mode: 'VIDEO', status: 'CANCELLED' },
  ],
  pays: [{ id: 1, ref: 'pay_Qx81aK', doctor: 'Dr. Ananya Rao', date: iso(day(-7)), amount: 99, status: 'SUCCESS' }, { id: 2, ref: 'pay_Qx90hD', doctor: 'Dr. Meera Iyer', date: iso(day(-1)), amount: 99, status: 'SUCCESS' }, { id: 3, ref: 'pay_Qx77aA', doctor: 'Dr. Vikram Shah', date: iso(day(-13)), amount: 99, status: 'REFUNDED' }],
  recs: [{ id: 1, name: 'Blood-report-aug.pdf', size: '84 KB' }, { id: 2, name: 'ECG-scan.pdf', size: '62 KB' }],
  notifs: [{ id: 1, t: 'Your visit with Dr. Ananya Rao is today at 16:30.', at: '2 hours ago', unread: true }, { id: 2, t: 'Payment of ₹99 received. Your booking with Dr. Meera Iyer is confirmed.', at: 'Yesterday', unread: true }, { id: 3, t: 'Your record ECG-scan.pdf was uploaded.', at: '3 days ago' }],
  profile: { name: 'Rahul Menon', phone: '+91 98765 04521', email: 'rahul.menon@example.com', height: '', weight: '' },
};

const when = a => `${fmt(a.date)}, ${a.time}`;
const docName = a => nm(a.doctor);
const join = () => toast('Your video link opens 10 minutes before the visit');
const normalizeAppointment = a => {
  const rawDate = a.date || a.appointment_date;
  const date = rawDate instanceof Date
    ? rawDate.toISOString().slice(0, 10)
    : String(rawDate || '').slice(0, 10);
  const rawMode = a.mode || a.consultation_mode;
  return {
    ...a,
    doctor: a.doctor || a.doctor_name || 'Doctor',
    date,
    time: a.time || a.start_time || '',
    mode: rawMode === 'FACE_TO_FACE' ? 'IN_PERSON' : rawMode,
  };
};

function Home({ go, user }) {
  const [a, , aErr] = useData('/patient/appointments', D.apps);
  const [p] = useData('/patient/profile', D.profile);
  const [r] = useData('/patient/medical-records', D.recs);
  const [instant, setInstant] = useData('/instant-consultations/patient/requests', []);
  const [instantRoom, setInstantRoom] = useState(null);
  useEffect(() => {
    if (demo()) return undefined;
    let live = true;
    const load = () => call('GET', '/instant-consultations/patient/requests').then(x => live && setInstant(x)).catch(() => {});
    load(); const timer = setInterval(load, 2500); return () => { live = false; clearInterval(timer); };
  }, [setInstant]);
  if (!a) return <Card><p className="empty">{aErr ? `Could not load your patient dashboard: ${aErr}` : 'Loading your patient dashboard…'}</p></Card>;
  const instantRows = list(instant);
  const activeInstant = instantRows[0];
  const appointments = list(a).map(normalizeAppointment);
  const up = appointments.filter(x => x.status === 'CONFIRMED').sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time));
  const nx = up[0], pr = p || D.profile;
  const pct = Math.round(['name', 'email', 'height', 'weight'].filter(k => pr[k]).length / 4 * 100);
  return <>
    {activeInstant && <Card title="Instant consultation"><p className="empty">{activeInstant.status === 'REQUESTED' ? `Waiting for ${activeInstant.doctor_name || 'the doctor'} to accept your request.` : activeInstant.status === 'ACCEPTED' ? `${activeInstant.doctor_name || 'The doctor'} accepted your request.` : 'Your private consultation is active.'}</p>{['ACCEPTED', 'ACTIVE'].includes(activeInstant.status) && !instantRoom && <button className="qb pri" onClick={async () => { try { setInstantRoom(await call('POST', `/instant-consultations/${activeInstant.id}/join`)); } catch (e) { toast(e.message); } }}>Join private call</button>}{instantRoom && <InstantCall consultationId={instantRoom.consultationId} roomToken={instantRoom.roomToken} role="PATIENT" onEnd={() => setInstantRoom(null)} />}</Card>}
    <Card className="hello">
      <div><h2>Hello, {user.name?.split(' ')[0]}</h2><p>{nx ? 'Here is what is coming up.' : 'You have no upcoming visits. Find a doctor when you are ready.'}</p></div>
      {nx ? <div className="nx"><span className="when">{iso(day(0)) === nx.date ? 'Today' : fmt(nx.date)}, {nx.time}</span><b>{docName(nx)}</b><span className="sub">{MODE[nx.mode] || nx.mode} consultation</span>
        <div className="qa" style={{ margin: '8px 0 0' }}>{nx.mode === 'VIDEO' && <button className="qb pri" onClick={join}>Join visit</button>}<button className="qb" onClick={() => go('apps')}>Details</button></div></div>
        : <button className="qb pri" onClick={() => go('find')}>Find a doctor</button>}
    </Card>
    <div className="tiles">
      {[['find', 'Find a doctor', 'Search by department'], ['apps', 'Appointments', 'Upcoming and past visits'], ['recs', 'Medical records', 'Upload and download PDFs'], ['pay', 'Payments', 'Receipts and history']].map(([k, t, s]) =>
        <button key={k} className="tile" onClick={() => go(k)}><b>{t}</b><span>{s}</span></button>)}
    </div>
    <div className="stats">
      <Stat ic="Ap" v={up.length} l="Upcoming visits" s="Confirmed and paid" />
      <Stat ic="Ok" v={appointments.filter(x => x.status === 'COMPLETED').length} l="Completed visits" s="In your history" />
      <Stat ic="Rc" v={list(r || []).length} l="Medical records" s="Stored privately" />
    </div>
    <div className="cols c2">
      <Card title="Coming up">{up.length ? up.slice(0, 4).map(x => <div className="rw" key={x.id}><div className="g"><b>{docName(x)}</b><span className="sub">{when(x)} · {MODE[x.mode] || x.mode}</span></div><Chip s={x.status} /></div>) : <p className="empty">Nothing booked yet.</p>}</Card>
      <Card title="Your profile" right={<span className="ch">{pct}% complete</span>}>
        <div className="bar"><i style={{ width: pct + '%' }} /></div>
        <p className="empty">{pct < 100 ? 'Adding your height and weight helps doctors prepare for your visit.' : 'Your profile is complete.'}</p>
        <button className="qb" onClick={() => go('prof')}>Update profile</button>
      </Card>
    </div>
  </>;
}

function Find({ go }) {
  const [depts] = useData('/patient/departments', D.depts);
  const [docs, , err] = useData('/patient/doctors', D.docs);
  const [f, setF] = useState('All'), [q, setQ] = useState(''), [sel, setSel] = useState(null);
  const [date, setDate] = useState(iso(day(1))), [slots, setSlots] = useState([]), [slot, setSlot] = useState(null), [mode, setMode] = useState('VIDEO'), [busy, setBusy] = useState(false);
  const [checkout, setCheckout] = useState(null);
  const [payBusy, setPayBusy] = useState(false);
  const [instantBusy, setInstantBusy] = useState(false);
  const [instantRequest, setInstantRequest] = useState(null), [instantRoom, setInstantRoom] = useState(null);
  useEffect(() => {
    if (!instantRequest?.id || demo()) return undefined;
    let live = true;
    const load = () => call('GET', `/instant-consultations/${instantRequest.id}`).then(x => live && setInstantRequest(x)).catch(() => {});
    load(); const timer = setInterval(load, 2500); return () => { live = false; clearInterval(timer); };
  }, [instantRequest?.id]);

  if (!docs) return null;
  const load = async (d, dt) => {
    setDate(dt); setSlot(null);
    try {
      const available = demo() ? D.slots : list(await call('GET', `/patient/doctors/${d.id}/slots?date=${dt}`));
      setSlots(available.map(s => typeof s === 'string' ? s : ({ ...s, start_time: s.start_time || s.startTime })));
    } catch (e) { toast(e.message); setSlots([]); }
  };
  const pick = d => { setSel(d); setMode((d.modes || ['VIDEO'])[0]); load(d, iso(day(1))); };
  const requestInstant = async () => {
    if (!sel) return toast('Select a doctor first');
    if (demo()) return toast('Instant consultation requires a verified live patient account.');
    setInstantBusy(true);
    try {
      const order = await call('POST', '/instant-consultation-payments/create-order', { doctorId: sel.id });
      await loadRazorpay();
      if (!window.Razorpay) throw new Error('Razorpay SDK could not be loaded.');
      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: order.keyId,
          order_id: order.orderId,
          amount: order.amount,
          currency: order.currency || 'INR',
          name: 'Careflow Health',
          description: `₹99 Instant Consultation - ${sel.name}`,
          prefill: { name: session.get()?.name || '', contact: session.get()?.phone || '' },
          theme: { color: '#0d9488' },
          handler: async response => {
            try {
              const verified = await call('POST', '/instant-consultation-payments/verify', { instantPaymentId: order.instantPaymentId, razorpayOrderId: response.razorpay_order_id || order.orderId, razorpayPaymentId: response.razorpay_payment_id, razorpaySignature: response.razorpay_signature });
              const c = await call('POST', '/instant-consultations/request', { doctorId: sel.id, instantPaymentId: verified.instantPaymentId });
              setInstantRequest(c); toast(`₹99 paid. Request sent to ${sel.name}. Please wait for the doctor to accept.`); resolve();
            } catch (e) { toast(e.message); reject(e); }
          },
          modal: { ondismiss: () => { toast('Payment window closed. No consultation request was sent.'); reject(new Error('Payment cancelled')); } },
        });
        rzp.open();
      });
    } catch (e) { if (e.message !== 'Payment cancelled') toast(e.message); }
    finally { setInstantBusy(false); }
  };

  const book = async () => {
    if (!slot) return toast('Pick a time slot first');
    if (demo()) {
      toast('Demo mode cannot create appointments. Sign in with a verified patient account to pay with Razorpay.');
      return;
    }
    setBusy(true);
    try {
      const ap = await call('POST', '/patient/appointments', {
        doctorId: sel.id,
        doctor_id: sel.id,
        appointmentDate: date,
        date,
        startTime: slot,
        start_time: slot,
        consultationMode: mode,
        mode,
      });
      const o = await call('POST', '/payments/create-order', {
        appointmentId: ap.id,
        appointment_id: ap.id,
      });

      const rzpOrderId = o.orderId || o.order_id || o.id;
      const rzpKey = o.keyId || o.key_id || import.meta.env.VITE_RAZORPAY_KEY;
      if (!rzpOrderId || !rzpKey) throw new Error('Razorpay payment is not configured. Please contact support.');

      const checkoutPayload = {
        ap,
        order: o,
        rzpOrderId,
        rzpKey,
        doctor: sel,
        date,
        slot,
        mode,
      };

      setCheckout(checkoutPayload);

      // Immediately launch Razorpay payment popup with user's test key
      try {
        await loadRazorpay();
        if (!window.Razorpay) throw new Error('Razorpay SDK could not be loaded.');
        {
          const rzp = new window.Razorpay({
            key: rzpKey,
            order_id: rzpOrderId,
            amount: o.amount || FEE * 100,
            currency: 'INR',
            name: 'Careflow Health',
            description: `₹${FEE} Platform Booking Fee - Dr. ${sel.name}`,
            prefill: {
              name: session.get()?.name || '',
              contact: session.get()?.phone || '',
            },
            theme: { color: '#0d9488' },
            handler: async r => {
              try {
                await call('POST', '/payments/verify', {
                  ...r,
                  razorpayOrderId: r.razorpay_order_id || rzpOrderId,
                  razorpayPaymentId: r.razorpay_payment_id,
                  razorpaySignature: r.razorpay_signature,
                  appointmentId: ap.id,
                  appointment_id: ap.id,
                });
                toast(`✓ Payment of ₹${FEE} received! Dr. ${sel.name} will confirm your appointment.`);
                setCheckout(null);
                setSlot(null);
                go('apps');
              } catch (err) {
                toast(err.message);
              }
            },
            modal: {
              ondismiss: () => {
                toast('Payment window closed. You can complete payment below.');
              },
            },
          });
          rzp.open();
        }
      } catch (rzpErr) {
        throw rzpErr;
      }
    } catch (e) { 
      toast(e.message); 
    } finally {
      setBusy(false);
    }
  };

  const launchRazorpay = async (c) => {
    setPayBusy(true);
    try {
      await loadRazorpay();
      if (!window.Razorpay) throw new Error('Razorpay SDK could not be loaded.');
      new window.Razorpay({
        key: c.rzpKey,
        order_id: c.rzpOrderId,
        amount: c.order.amount || FEE * 100,
        currency: 'INR',
        name: 'Careflow Health',
        description: `₹${FEE} Platform Booking Fee`,
        handler: async r => {
          try {
            await call('POST', '/payments/verify', { ...r, appointmentId: c.ap.id, appointment_id: c.ap.id });
            toast(`✓ Payment of ₹${FEE} received! Dr. ${c.doctor.name} will confirm your appointment.`);
            setCheckout(null);
            setSlot(null);
            go('apps');
          } catch (err) {
            toast(err.message);
          }
        },
        modal: { ondismiss: () => toast('Payment cancelled. The appointment remains held.') }
      }).open();
    } catch (e) {
      toast(e.message);
    } finally {
      setPayBusy(false);
    }
  };

  const doctors = list(docs).map(normalizeDoctor);
  const departmentOptions = list(depts).map(d => nm(d.name || d.department_name || d));
  const rows = doctors.filter(d => {
    const matchDept = f === 'All' || d.department === f || 
      (f === 'Gynecology' && (d.department || '').toLowerCase().includes('gynecol')) ||
      (f === 'General Medicine' && ((d.department || '').toLowerCase().includes('general') || (d.department || '').toLowerCase().includes('internal')));
    const matchSearch = !q || (d.name + ' ' + d.department + ' ' + (d.qualification || '')).toLowerCase().includes(q.toLowerCase());
    return matchDept && matchSearch;
  });
  return <>
    {err && <p className="note">Could not load live data: {err}</p>}
    <div className="qa"><input aria-label="Search doctors" placeholder="Search by name or department" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 320 }} /></div>
    <div className="pills">{['All', ...departmentOptions].map(x => <button key={x} aria-pressed={f === x} onClick={() => setF(x)}>{x}</button>)}</div>
    <div className="dgrid">{rows.map(d => <button key={d.id} className="card dc" aria-current={sel?.id === d.id} onClick={() => pick(d)}>
      <div className="top2"><div className="dav">{ini(d.name)}</div><div><b>{d.name}</b><span className="sub">{nm(d.department)} · {d.experience} years</span></div></div>
      <div className="tags"><span className="ch ok">Verified {d.registration_no}</span><span className="ch">★ {d.rating} ({d.reviews})</span></div>
      <span className="sub">{d.qualification}</span>
      <div className="tags">{(d.modes || []).map(m => <span className="ch" key={m}>{MODE[m]}</span>)}</div>
      <span className="sub">{inr(d.fee || d.consultation_fee)} paid at the visit</span>
    </button>)}</div>
    {!rows.length && <p className="empty">No doctors match. Try another department.</p>}
    {sel && <div className="cols c2">
      <Card title={`About ${sel.name}`}><p style={{ margin: '0 0 8px' }}>{sel.about}</p>
        <div className="lbl">Qualification</div><div>{sel.qualification}</div>
        <div className="lbl">Case studies</div><ul style={{ margin: 0, paddingLeft: 18 }}>{(sel.cases || []).map(c => <li key={c}>{c}</li>)}</ul></Card>
      <Card title="Book an appointment">
        <div className="lbl">1. Choose a date</div>
        <div className="strip">{Array.from({ length: 7 }, (_, i) => iso(day(i + 1))).map(dt => <button key={dt} aria-pressed={date === dt} onClick={() => load(sel, dt)}>{fmt(dt)}</button>)}</div>
        <div className="lbl">2. Choose a time</div>
        <div className="slots">{slots.map(s => { const t = typeof s === 'string' ? s : s.start_time; return <button key={t} aria-pressed={slot === t} onClick={() => setSlot(t)}>{t}</button>; })}</div>
        {!slots.length && <p className="empty">No free slots on this date.</p>}
        <div className="lbl">3. How would you like to meet?</div>
        <div className="pills">{(sel.modes || ['VIDEO']).map(m => <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>{MODE[m]}</button>)}</div>
        <div className="qa" style={{ margin: 0 }}><button className="qb pri" disabled={!slot || busy} onClick={book}>Pay {inr(FEE)} booking fee and confirm</button></div>
        <div className="qa" style={{ margin: '10px 0 0' }}><button className="qb" disabled={instantBusy} onClick={requestInstant}>{instantBusy ? 'Opening secure payment…' : 'Pay ₹99 & Request Instant Consultation'}</button></div>
        {instantRequest && instantRequest.doctor_id === sel.id && <div style={{ marginTop: 10 }}><p className="empty">Instant request: <b>{instantRequest.status}</b></p>{instantRequest.status === 'ACCEPTED' && !instantRoom && <button className="qb pri" onClick={async () => { try { setInstantRoom(await call('POST', `/instant-consultations/${instantRequest.id}/join`)); } catch (e) { toast(e.message); } }}>Join private call</button>}{instantRoom && <InstantCall consultationId={instantRoom.consultationId} roomToken={instantRoom.roomToken} role="PATIENT" onEnd={() => setInstantRoom(null)} />}</div>}
        <p className="empty">The slot is held for 10 minutes while you pay. The doctor’s fee is paid directly at the visit.</p>
      </Card>
    </div>}

    {checkout && (
      <div className="modal-backdrop" onClick={() => !payBusy && setCheckout(null)} role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
        <div className="card" onClick={e => e.stopPropagation()} style={{ maxWidth: 440, width: '100%', background: '#0e1c2e', border: '1px solid #233b5d', borderRadius: 16, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.5)', color: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#10b981' }}>Secure Payment</span>
              <h3 style={{ margin: '4px 0 0', fontSize: 18 }}>Pay ₹{FEE} Platform Booking Fee</h3>
            </div>
            {!payBusy && <button onClick={() => setCheckout(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 20, cursor: 'pointer', padding: 4 }}>✕</button>}
          </div>

          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 14px', marginBottom: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: '#94a3b8' }}>Doctor</span>
              <b>{checkout.doctor.name}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: '#94a3b8' }}>Department</span>
              <span>{checkout.doctor.department}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: '#94a3b8' }}>Slot Time</span>
              <b>{fmt(checkout.date)}, {checkout.slot} ({MODE[checkout.mode]})</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, paddingTop: 8, borderTop: '1px dashed rgba(255,255,255,0.15)', marginTop: 8 }}>
              <span style={{ color: '#fff' }}>Payable Now (Booking Fee)</span>
              <b style={{ color: '#10b981', fontSize: 16 }}>₹{FEE}.00</b>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
              * Doctor visit fee of {inr(checkout.doctor.fee || checkout.doctor.consultation_fee)} is payable directly at consultation.
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button 
              className="qb pri" 
              disabled={payBusy} 
              style={{ width: '100%', padding: '13px', fontSize: 15, fontWeight: 'bold', background: '#10b981', borderColor: '#10b981', color: '#fff' }}
              onClick={() => launchRazorpay(checkout)}
            >
              {payBusy ? 'Opening Razorpay...' : `Pay ₹${FEE} with Razorpay →`}
            </button>
          </div>

          <p style={{ margin: '14px 0 0', fontSize: 11, textAlign: 'center', color: '#94a3b8', lineHeight: 1.4 }}>
            🔒 256-bit encrypted. Once ₹{FEE} is paid, Dr. {checkout.doctor.name} will confirm your appointment.
          </p>
        </div>
      </div>
      </div>
    )}
  </>;
}

function Apps({ go }) {
  const [a, setA, err] = useData('/patient/appointments', D.apps);
  const t0 = iso(day(0));
  const appointments = list(a).map(normalizeAppointment);
  const hasPending = appointments.some(x => x.status === 'WAITING' || x.status === 'PAYMENT_PENDING' || x.status === 'HELD');
  const [tab, setTab] = useState(hasPending ? 'Pending Confirmation' : 'Upcoming');
  const [autoSelectedPending, setAutoSelectedPending] = useState(false);
  const [payingId, setPayingId] = useState(null);
  useEffect(() => {
    if (a && hasPending && !autoSelectedPending) {
      setTab('Pending Confirmation');
      setAutoSelectedPending(true);
    }
  }, [a, hasPending, autoSelectedPending]);
  if (!a) return null;
  const view = { 
    'Pending Confirmation': x => x.status === 'WAITING' || x.status === 'PAYMENT_PENDING' || x.status === 'HELD',
    Today: x => (x.status === 'CONFIRMED' || x.status === 'SCHEDULED') && x.date === t0, 
    Upcoming: x => (x.status === 'CONFIRMED' || x.status === 'SCHEDULED') && x.date > t0, 
    Completed: x => x.status === 'COMPLETED', 
    Cancelled: x => x.status === 'CANCELLED' 
  };
  const rows = appointments.filter(view[tab]);
  const cancel = async x => { 
    try { 
      await act('PATCH', `/patient/appointments/${x.id}/cancel`); 
      setA(list(a).map(y => y.id === x.id ? { ...y, status: 'CANCELLED' } : y)); 
      toast('Appointment cancelled'); 
    } catch (e) { 
      toast(e.message); 
    } 
  };
  const resumePayment = async x => {
    setPayingId(x.id);
    try {
      const order = await call('POST', '/payments/create-order', {
        appointmentId: x.id,
        appointment_id: x.id,
      });
      const rzpOrderId = order.orderId || order.order_id || order.id;
      const rzpKey = order.keyId || order.key_id || import.meta.env.VITE_RAZORPAY_KEY;
      if (!rzpOrderId || !rzpKey) throw new Error('Razorpay payment is not configured. Please contact support.');

      await loadRazorpay();
      if (!window.Razorpay) throw new Error('Razorpay SDK could not be loaded.');
      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: rzpKey,
          order_id: rzpOrderId,
          amount: order.amount || FEE * 100,
          currency: order.currency || 'INR',
          name: 'Careflow Health',
          description: `₹${FEE} Platform Booking Fee`,
          prefill: {
            name: session.get()?.name || '',
            contact: session.get()?.phone || '',
          },
          theme: { color: '#0d9488' },
          handler: async response => {
            try {
              await call('POST', '/payments/verify', {
                ...response,
                razorpayOrderId: response.razorpay_order_id || rzpOrderId,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                appointmentId: x.id,
                appointment_id: x.id,
              });
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          modal: {
            ondismiss: () => reject(new Error('Payment cancelled. The appointment remains pending payment.')),
          },
        });
        rzp.on('payment.failed', response => reject(new Error(response.error?.description || 'Payment failed')));
        rzp.open();
      });

      setA(list(a).map(y => y.id === x.id ? { ...y, status: 'WAITING', payment_status: 'SUCCESS' } : y));
      toast('✓ Payment completed. The doctor will confirm your appointment shortly.');
    } catch (e) {
      toast(e.message);
    } finally {
      setPayingId(null);
    }
  };
  return <>
    {err && <p className="note">Showing sample data. {err}</p>}
    {hasPending && (
      <div style={{ background: 'rgba(234, 179, 8, 0.15)', border: '1px solid #eab308', borderRadius: 8, padding: '10px 16px', color: '#fef08a', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <span>⏳ You have <b>{appointments.filter(view['Pending Confirmation']).length}</b> booking(s) awaiting doctor confirmation. The doctor will confirm your slot shortly.</span>
        <button className="qb pri sm" onClick={() => setTab('Pending Confirmation')}>View Pending →</button>
      </div>
    )}
    <div className="pills">{Object.keys(view).map(k => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{k} ({appointments.filter(view[k]).length})</button>)}</div>
    <Card>{rows.length ? rows.map(x => <div className="rw" key={x.id}>
      <div className="g">
        <b>{docName(x)}</b>
        <span className="sub">{when(x)} · {MODE[x.mode] || x.mode}</span>
        {x.status === 'WAITING' && (
          <span style={{ fontSize: 12, color: '#fcd34d', display: 'block', marginTop: 2 }}>
            ✓ ₹99 Booking fee paid · Waiting for doctor to confirm
          </span>
        )}
      </div>
      <Chip s={x.status} />
      {x.status === 'CONFIRMED' && x.mode === 'VIDEO' && x.date === t0 && <button className="qb pri sm" onClick={join}>Join</button>}
      {x.status === 'CONFIRMED' && <><button className="sm" onClick={() => go('find')}>Reschedule</button><button className="sm" onClick={() => cancel(x)}>Cancel</button></>}
      {(x.status === 'HELD' || x.status === 'PAYMENT_PENDING') && <button className="qb pri sm" disabled={payingId === x.id} onClick={() => resumePayment(x)}>{payingId === x.id ? 'Opening payment…' : 'Complete payment'}</button>}
      {(x.status === 'WAITING' || x.status === 'PAYMENT_PENDING' || x.status === 'HELD') && <button className="sm" style={{ borderColor: '#f43f5e', color: '#f43f5e' }} onClick={() => cancel(x)}>Cancel Booking</button>}
    </div>) : <p className="empty">No {tab.toLowerCase()} appointments. <button className="sm" onClick={() => go('find')}>Find a doctor</button></p>}</Card>
  </>;
}

function Pays() {
  const [p, , err] = useData('/patient/payments', D.pays);
  if (!p) return null;
  const L = list(p), paid = L.filter(x => x.status === 'SUCCESS');
  const receipt = x => {
    const b = new Blob([`Careflow receipt\nReference: ${x.ref}\nDoctor: ${nm(x.doctor)}\nDate: ${x.date}\nAmount: ${inr(x.amount)}\nStatus: ${x.status}\n`], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `receipt-${x.ref}.txt`; a.click(); URL.revokeObjectURL(a.href);
  };
  return <>{err && <p className="note">Showing sample data. {err}</p>}
    <div className="stats"><Stat ic="₹" v={inr(paid.reduce((s, x) => s + x.amount, 0))} l="Booking fees paid" s={`${paid.length} successful payments`} /><Stat ic="Rc" v={L.length} l="Receipts" s="Download any time" /></div>
    <Card title="Payment history"><Table rows={L} cols={[{ h: 'Reference', k: 'ref' }, { h: 'Doctor', r: x => nm(x.doctor) }, { h: 'Date', r: x => fmt(x.date) }, { h: 'Amount', r: x => inr(x.amount) }, { h: 'Status', r: x => <Chip s={x.status} /> }, { h: '', r: x => <button className="sm" onClick={() => receipt(x)}>Receipt</button> }]} /></Card></>;
}

function Records() {
  const [r, setR, err] = useData('/patient/medical-records', D.recs);
  if (!r) return null;
  const up = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 102400) return toast('That file is over 100 KB');
    try {
      const fd = new FormData(); fd.append('file', f);
      const saved = demo() ? null : await call('POST', '/patient/medical-records', fd);
      setR([saved || { id: Date.now(), name: `${f.name}.pdf`, size: `${Math.round(f.size / 1024)} KB` }, ...list(r)]);
      toast('Record converted to PDF and uploaded');
    } catch (x) { toast(x.message); }
  };
  const dl = async x => {
    if (demo()) return toast('Downloads work once the app is connected to your backend');
    try { const res = await fetch(`${BASE}/patient/medical-records/${x.id}/download`, { headers: { Authorization: 'Bearer ' + session.get()?.token } }); if (!res.ok) throw new Error('Download failed'); const u = URL.createObjectURL(await res.blob()); const a = document.createElement('a'); a.href = u; a.download = x.name || 'record.pdf'; a.click(); URL.revokeObjectURL(u); } catch (e) { toast(e.message); }
  };
  return <>{err && <p className="note">Showing sample data. {err}</p>}
    <Card title="Medical records" right={<label className="qb pri" style={{ cursor: 'pointer' }}>Upload file<input type="file" accept="*/*" hidden onChange={up} /></label>}>
      {list(r).length ? list(r).map(x => <div className="rw" key={x.id}><div className="g"><b>{x.name || x.file_name}</b><span className="sub">PDF · {x.size || 'private'} · converted securely; only you and your doctors can open it</span></div><button className="sm" onClick={() => dl(x)}>Download</button></div>) : <p className="empty">No records yet. Upload any file under 100 KB; it will be converted to PDF and stored privately.</p>}
    </Card></>;
}

function Profile() {
  const [p, setP, err] = useData('/patient/profile', D.profile);
  const [v, setV] = useState(null);
  if (!p) return null;

  const baseProfile = {
    ...p,
    name: p.name || '',
    phone: p.phone || '',
    email: p.email || '',
    height: p.height ?? p.height_cm ?? '',
    weight: p.weight ?? p.weight_kg ?? '',
  };

  const f = v || baseProfile;
  const set = k => e => setV({ ...f, [k]: e.target.value });

  const save = async () => {
    try {
      const hNum = f.height === '' || f.height === null || f.height === undefined ? null : Number(f.height);
      const wNum = f.weight === '' || f.weight === null || f.weight === undefined ? null : Number(f.weight);
      const res = await act('PATCH', '/patient/profile', {
        name: f.name || '',
        email: f.email || '',
        height: hNum,
        height_cm: hNum,
        weight: wNum,
        weight_kg: wNum,
      });
      if (res) {
        setP(res);
        setV(null);
      }
      toast('✓ Profile saved successfully!');
    } catch (e) {
      toast(e.message || 'Failed to save profile');
    }
  };

  return (
    <>
      {err && <p className="note">Showing sample data. {err}</p>}
      <Card title="Your details">
        <div className="fm">
          <label>Full name<input value={f.name || ''} onChange={set('name')} /></label>
          <label>Phone number<input readOnly value={f.phone || ''} /></label>
          <label className="full">Email<input type="email" value={f.email || ''} onChange={set('email')} /></label>
          <label>Height (cm)<input type="number" min="30" max="250" value={f.height ?? ''} onChange={set('height')} placeholder="e.g. 175" /></label>
          <label>Weight (kg)<input type="number" min="1" max="500" value={f.weight ?? ''} onChange={set('weight')} placeholder="e.g. 70" /></label>
        </div>
        <div className="qa" style={{ marginTop: 14 }}>
          <button className="qb pri" onClick={save}>Save profile</button>
        </div>
      </Card>
    </>
  );
}

function Notifs() {
  const [n, setN, err] = useData('/notifications', D.notifs);
  if (!n) return <><p className="note">{err ? `Could not load notifications: ${err}` : 'Loading notifications…'}</p></>;
  return <>{err && <p className="note">Showing sample data. {err}</p>}
    <Card title="Notifications" right={<button className="sm" onClick={() => setN(list(n).map(x => ({ ...x, unread: false })))}>Mark all as read</button>}>
      {list(n).map(x => <div className="rw" key={x.id}><i className={'dot' + (x.unread ? '' : ' off')} /><div className="g"><b style={{ fontWeight: x.unread ? 600 : 400 }}>{x.t || x.message}</b><span className="sub">{x.at || x.created_at}</span></div></div>)}
    </Card></>;
}

export const patientPages = { dash: Home, find: Find, apps: Apps, recs: Records, pay: Pays, prof: Profile, notif: Notifs };
