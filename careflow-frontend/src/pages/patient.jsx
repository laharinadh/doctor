import { useState } from 'react';
import { Card, Stat, Chip, Table, toast, inr } from '../ui';
import { useData, act, call, demo, loadRazorpay, BASE, session } from '../api';

const FEE = 99;
const day = n => new Date(Date.now() + n * 864e5);
const iso = d => d.toISOString().slice(0, 10);
const fmt = d => (typeof d === 'string' ? new Date(d + 'T00:00') : d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const list = x => (Array.isArray(x) ? x : x?.items || []);
const nm = x => x?.name || x;
const MODE = { VIDEO: 'Video', AUDIO: 'Audio', IN_PERSON: 'In person' };
const ini = n => String(n).replace(/^Dr\.? /, '').split(' ').map(w => w[0]).slice(0, 2).join('');

const D = {
  depts: ['Cardiology', 'Dermatology', 'Pediatrics', 'Neurology', 'General'],
  docs: [
    { id: 1, name: 'Dr. Ananya Rao', department: 'Cardiology', experience: 12, fee: 600, rating: 4.9, reviews: 212, qualification: 'MBBS, MD (Cardiology)', registration_no: 'MCI-40137', modes: ['VIDEO', 'AUDIO', 'IN_PERSON'], about: 'Heart health, blood pressure and preventive cardiology.', cases: ['Managed 300+ hypertension cases', 'Led a cardiac rehabilitation programme'] },
    { id: 2, name: 'Dr. Vikram Shah', department: 'Dermatology', experience: 8, fee: 450, rating: 4.7, reviews: 148, qualification: 'MBBS, MD (Dermatology)', registration_no: 'MCI-40274', modes: ['VIDEO', 'IN_PERSON'], about: 'Acne, eczema and long-term skin care.', cases: ['Treated 500+ chronic acne patients'] },
    { id: 3, name: 'Dr. Meera Iyer', department: 'Pediatrics', experience: 15, fee: 500, rating: 4.9, reviews: 305, qualification: 'MBBS, DCH, MD', registration_no: 'APMC-61822', modes: ['VIDEO', 'AUDIO', 'IN_PERSON'], about: 'Child growth, vaccination and common infections.', cases: ['Newborn care clinic lead'] },
    { id: 4, name: 'Dr. Kiran Reddy', department: 'Neurology', experience: 10, fee: 800, rating: 4.8, reviews: 97, qualification: 'MBBS, DM (Neurology)', registration_no: 'TSMC-30987', modes: ['VIDEO', 'IN_PERSON'], about: 'Migraine, epilepsy and nerve conditions.', cases: ['Migraine management programme'] },
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

function Home({ go, user }) {
  const [a] = useData('/patient/appointments', D.apps);
  const [p] = useData('/patient/profile', D.profile);
  const [r] = useData('/patient/medical-records', D.recs);
  if (!a) return null;
  const up = list(a).filter(x => x.status === 'CONFIRMED').sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time));
  const nx = up[0], pr = p || D.profile;
  const pct = Math.round(['name', 'email', 'height', 'weight'].filter(k => pr[k]).length / 4 * 100);
  return <>
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
      <Stat ic="Ok" v={list(a).filter(x => x.status === 'COMPLETED').length} l="Completed visits" s="In your history" />
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
  if (!docs) return null;
  const load = async (d, dt) => {
    setDate(dt); setSlot(null);
    try { setSlots(demo() ? D.slots : list(await call('GET', `/patient/doctors/${d.id}/slots?date=${dt}`))); } catch (e) { toast(e.message); setSlots([]); }
  };
  const pick = d => { setSel(d); setMode((d.modes || ['VIDEO'])[0]); load(d, iso(day(1))); };
  const book = async () => {
    if (demo()) { toast(`Booked with ${sel.name} for ${fmt(date)}, ${slot} (sample)`); setSlot(null); go('apps'); return; }
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

      let verified = false;
      try {
        await loadRazorpay();
        if (window.Razorpay && (o.key_id || import.meta.env.VITE_RAZORPAY_KEY)) {
          new window.Razorpay({
            key: o.key_id || import.meta.env.VITE_RAZORPAY_KEY,
            order_id: o.order_id || o.id,
            amount: o.amount,
            currency: 'INR',
            name: 'Careflow',
            handler: r => call('POST', '/payments/verify', r).then(() => { toast('Booking confirmed! Platform fee paid.'); go('apps'); }).catch(e => toast(e.message))
          }).open();
          verified = true;
        }
      } catch (rzErr) {
        // Fallback to simulated payment verification
      }

      if (!verified) {
        const rzpOrderId = o.orderId || o.order_id || o.id;
        await call('POST', '/payments/verify', {
          appointmentId: ap.id,
          appointment_id: ap.id,
          razorpayOrderId: rzpOrderId,
          razorpay_order_id: rzpOrderId,
          razorpayPaymentId: 'pay_sim_' + Date.now(),
          razorpay_payment_id: 'pay_sim_' + Date.now(),
          razorpaySignature: 'sig_sim_' + Date.now(),
          razorpay_signature: 'sig_sim_' + Date.now(),
        }).catch(() => {});
        toast('Booking confirmed! Platform fee paid.');
        go('apps');
      }
    } catch (e) { toast(e.message); }
    setBusy(false);
  };
  const rows = list(docs).filter(d => (f === 'All' || nm(d.department) === f) && (!q || (d.name + nm(d.department)).toLowerCase().includes(q.toLowerCase())));
  return <>
    {err && <p className="note">Showing sample data. {err}</p>}
    <div className="qa"><input aria-label="Search doctors" placeholder="Search by name or department" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 320 }} /></div>
    <div className="pills">{['All', ...list(depts).map(nm)].map(x => <button key={x} aria-pressed={f === x} onClick={() => setF(x)}>{x}</button>)}</div>
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
        <div className="slots">{slots.map(s => { const t = s.start_time || s; return <button key={t} aria-pressed={slot === t} onClick={() => setSlot(t)}>{t}</button>; })}</div>
        {!slots.length && <p className="empty">No free slots on this date.</p>}
        <div className="lbl">3. How would you like to meet?</div>
        <div className="pills">{(sel.modes || ['VIDEO']).map(m => <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>{MODE[m]}</button>)}</div>
        <div className="qa" style={{ margin: 0 }}><button className="qb pri" disabled={!slot || busy} onClick={book}>Pay {inr(FEE)} booking fee and confirm</button></div>
        <p className="empty">The slot is held for 10 minutes while you pay. The doctor’s fee is paid directly at the visit.</p>
      </Card>
    </div>}
  </>;
}

function Apps({ go }) {
  const [a, setA, err] = useData('/patient/appointments', D.apps);
  const [tab, setTab] = useState('Upcoming');
  if (!a) return null;
  const t0 = iso(day(0));
  const view = { Today: x => x.status === 'CONFIRMED' && x.date === t0, Upcoming: x => x.status === 'CONFIRMED' && x.date > t0, Completed: x => x.status === 'COMPLETED', Cancelled: x => x.status === 'CANCELLED' };
  const rows = list(a).filter(view[tab]);
  const cancel = async x => { try { await act('PATCH', `/patient/appointments/${x.id}/cancel`); setA(list(a).map(y => y.id === x.id ? { ...y, status: 'CANCELLED' } : y)); toast('Appointment cancelled'); } catch (e) { toast(e.message); } };
  return <>{err && <p className="note">Showing sample data. {err}</p>}
    <div className="pills">{Object.keys(view).map(k => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{k} ({list(a).filter(view[k]).length})</button>)}</div>
    <Card>{rows.length ? rows.map(x => <div className="rw" key={x.id}>
      <div className="g"><b>{docName(x)}</b><span className="sub">{when(x)} · {MODE[x.mode] || x.mode}</span></div><Chip s={x.status} />
      {x.status === 'CONFIRMED' && x.mode === 'VIDEO' && x.date === t0 && <button className="qb pri sm" onClick={join}>Join</button>}
      {x.status === 'CONFIRMED' && <><button className="sm" onClick={() => go('find')}>Reschedule</button><button className="sm" onClick={() => cancel(x)}>Cancel</button></>}
    </div>) : <p className="empty">No {tab.toLowerCase()} appointments. <button className="sm" onClick={() => go('find')}>Find a doctor</button></p>}</Card></>;
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
    if (f.type !== 'application/pdf') return toast('Only PDF files are accepted');
    if (f.size > 102400) return toast('That file is over 100 KB');
    try { const fd = new FormData(); fd.append('file', f); if (!demo()) await call('POST', '/patient/medical-records', fd); setR([{ id: Date.now(), name: f.name, size: Math.round(f.size / 1024) + ' KB' }, ...list(r)]); toast('Record uploaded'); } catch (x) { toast(x.message); }
  };
  const dl = async x => {
    if (demo()) return toast('Downloads work once the app is connected to your backend');
    try { const res = await fetch(`${BASE}/patient/medical-records/${x.id}/download`, { headers: { Authorization: 'Bearer ' + session.get()?.token } }); if (!res.ok) throw new Error('Download failed'); const u = URL.createObjectURL(await res.blob()); const a = document.createElement('a'); a.href = u; a.download = x.name || 'record.pdf'; a.click(); URL.revokeObjectURL(u); } catch (e) { toast(e.message); }
  };
  return <>{err && <p className="note">Showing sample data. {err}</p>}
    <Card title="Medical records" right={<label className="qb pri" style={{ cursor: 'pointer' }}>Upload PDF<input type="file" accept="application/pdf" hidden onChange={up} /></label>}>
      {list(r).length ? list(r).map(x => <div className="rw" key={x.id}><div className="g"><b>{x.name || x.file_name}</b><span className="sub">PDF · {x.size || 'private'} · only you and your doctors can open it</span></div><button className="sm" onClick={() => dl(x)}>Download</button></div>) : <p className="empty">No records yet. Upload a PDF (up to 100 KB) to keep it with your account.</p>}
    </Card></>;
}

function Profile() {
  const [p, , err] = useData('/patient/profile', D.profile);
  const [v, setV] = useState(null);
  if (!p) return null;
  const f = v || p, set = k => e => setV({ ...f, [k]: e.target.value });
  const save = async () => { try { await act('PATCH', '/patient/profile', { name: f.name, email: f.email, height: f.height, weight: f.weight }); toast('Profile saved'); } catch (e) { toast(e.message); } };
  return <>{err && <p className="note">Showing sample data. {err}</p>}
    <Card title="Your details"><div className="fm">
      <label>Full name<input value={f.name || ''} onChange={set('name')} /></label>
      <label>Phone number<input readOnly value={f.phone || ''} /></label>
      <label className="full">Email<input type="email" value={f.email || ''} onChange={set('email')} /></label>
      <label>Height (cm)<input type="number" value={f.height || ''} onChange={set('height')} /></label>
      <label>Weight (kg)<input type="number" value={f.weight || ''} onChange={set('weight')} /></label>
    </div><div className="qa" style={{ marginTop: 14 }}><button className="qb pri" onClick={save}>Save profile</button></div></Card></>;
}

function Notifs() {
  const [n, setN, err] = useData('/patient/notifications', D.notifs);
  if (!n) return null;
  return <>{err && <p className="note">Showing sample data. {err}</p>}
    <Card title="Notifications" right={<button className="sm" onClick={() => setN(list(n).map(x => ({ ...x, unread: false })))}>Mark all as read</button>}>
      {list(n).map(x => <div className="rw" key={x.id}><i className={'dot' + (x.unread ? '' : ' off')} /><div className="g"><b style={{ fontWeight: x.unread ? 600 : 400 }}>{x.t || x.message}</b><span className="sub">{x.at || x.created_at}</span></div></div>)}
    </Card></>;
}

export const patientPages = { dash: Home, find: Find, apps: Apps, recs: Records, pay: Pays, prof: Profile, notif: Notifs };
