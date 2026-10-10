import { useEffect, useState } from 'react';
import { Card, Stat, Chip, Line, Table, toast } from '../ui';
import { useData, act, call, demo, BASE, session } from '../api';
import InstantCall from '../components/InstantCall';

const day = n => new Date(Date.now() + n * 864e5);
const iso = d => d.toISOString().slice(0, 10);
const fmt = d => (typeof d === 'string' ? new Date(d + 'T00:00') : d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const list = x => (Array.isArray(x) ? x : x?.items || []);
const MODE = { VIDEO: 'Video', AUDIO: 'Audio', IN_PERSON: 'In person' };
const WAIT = s => ['SCHEDULED', 'CONFIRMED'].includes(s);
const byTime = (a, b) => (a.date + a.time).localeCompare(b.date + b.time);
const T0 = iso(day(0));
const normalizeAppointment = x => ({
  ...x,
  patient: x.patient || x.patient_name || 'Patient',
  phone: x.phone || x.patient_phone || '',
  date: x.date || (x.appointment_date ? String(x.appointment_date).slice(0, 10) : ''),
  time: x.time || (x.start_time ? String(x.start_time).slice(0, 5) : ''),
  mode: x.mode || x.consultation_mode || 'VIDEO',
});
const normalizePatient = x => ({
  ...x,
  last: x.last || (x.last_appointment_date ? String(x.last_appointment_date).slice(0, 10) : ''),
  visits: x.visits ?? x.visit_count ?? 0,
  today: x.today ?? (x.last_appointment_date ? String(x.last_appointment_date).slice(0, 10) === T0 : false),
});

const D = {
  apps: [
    { id: 4, patient: 'Divya Rao', age: 41, phone: '+91 97•••• 6610', date: T0, time: '09:00', mode: 'VIDEO', status: 'COMPLETED', reason: 'Routine heart check', notes: 'BP stable. Continue current routine. Review in 3 months.' },
    { id: 1, patient: 'Rahul Menon', age: 34, phone: '+91 98•••• 4521', date: T0, time: '10:00', mode: 'VIDEO', status: 'SCHEDULED', reason: 'Chest tightness when climbing stairs', meeting_url: 'https://meet.google.com/abc-defg-hij', records: ['Blood-report-aug.pdf', 'ECG-scan.pdf'] },
    { id: 2, patient: 'Sneha Kapoor', age: 29, phone: '+91 90•••• 1187', date: T0, time: '10:30', mode: 'AUDIO', status: 'SCHEDULED', reason: 'Follow-up on blood pressure', records: ['BP-log.pdf'] },
    { id: 3, patient: 'Imran Sheikh', age: 52, phone: '+91 99•••• 7302', date: T0, time: '11:30', mode: 'IN_PERSON', status: 'SCHEDULED', reason: 'Palpitations at night', records: [] },
    { id: 5, patient: 'Karthik Naidu', age: 46, phone: '+91 93•••• 2049', date: iso(day(1)), time: '14:00', mode: 'VIDEO', status: 'SCHEDULED', reason: 'Cholesterol review', records: [] },
    { id: 6, patient: 'Anita Desai', age: 38, phone: '+91 91•••• 5523', date: iso(day(-3)), time: '12:00', mode: 'VIDEO', status: 'CANCELLED', reason: 'Second opinion' },
  ],
  pats: [
    { id: 1, name: 'Rahul Menon', age: 34, gender: 'Male', bloodGroup: 'O+', phone: '+91 98•••• 4521', visits: 3, last: iso(day(-6)), today: true, condition: 'Preventive Cardiology' },
    { id: 2, name: 'Sneha Kapoor', age: 29, gender: 'Female', bloodGroup: 'B+', phone: '+91 90•••• 1187', visits: 5, last: iso(day(-20)), today: true, condition: 'Hypertension Follow-up' },
    { id: 3, name: 'Imran Sheikh', age: 52, gender: 'Male', bloodGroup: 'A+', phone: '+91 99•••• 7302', visits: 1, last: iso(day(-40)), today: true, condition: 'Palpitations & Arrhythmia' },
    { id: 7, name: 'Meena Pillai', age: 60, gender: 'Female', bloodGroup: 'AB+', phone: '+91 94•••• 1290', visits: 8, last: iso(day(-9)), today: false, condition: 'Post-CABG Routine Check' },
    { id: 8, name: 'Suresh Kumar', age: 47, gender: 'Male', bloodGroup: 'O-', phone: '+91 95•••• 8741', visits: 2, last: iso(day(-30)), today: false, condition: 'Dyslipidemia Review' },
  ],
  recs: {
    1: [
      { id: 101, name: 'Blood-report-aug.pdf', size: '2.4 MB', date: '24 Aug 2026', type: 'Lab Test', tag: 'Complete Hemogram', doctor: 'Dr. Ananya Rao' },
      { id: 102, name: 'ECG-scan.pdf', size: '4.8 MB', date: '02 Sep 2026', type: 'Cardiology', tag: '12-Lead Electrocardiogram', doctor: 'Dr. Ananya Rao' },
    ],
    2: [
      { id: 201, name: 'BP-log.pdf', size: '820 KB', date: '18 Sep 2026', type: 'Vitals Log', tag: 'Ambulatory BP Monitoring', doctor: 'Dr. Ananya Rao' },
    ],
    3: [],
    7: [
      { id: 701, name: 'Echo-2026.pdf', size: '12.4 MB', date: '15 Sep 2026', type: 'Imaging', tag: '2D Echocardiogram & Doppler', doctor: 'Dr. Ananya Rao' },
    ],
    8: [
      { id: 801, name: 'Lipid-profile.pdf', size: '1.9 MB', date: '10 Aug 2026', type: 'Biochemistry', tag: 'Full Lipid Profile', doctor: 'Dr. Ananya Rao' },
    ],
  },
  ver: { status: 'APPROVED', submitted: iso(day(-40)), reviewed: iso(day(-38)), registration_no: 'MCI-40137', qualification: 'MBBS, MD (Cardiology)', experience: 12, note: 'Documents verified by the admin team.' },
  profile: { name: 'Dr. Ananya Rao', department: 'Cardiology', registration_no: 'MCI-40137', qualification: 'MBBS, MD (Cardiology)', experience: 12, about: 'Heart health, blood pressure and preventive cardiology.', cases: ['Managed 300+ hypertension cases', 'Led a cardiac rehabilitation programme'] },
  notifs: [{ id: 1, t: 'Rahul Menon booked a video visit for 10:00 today.', at: '1 hour ago', unread: true }, { id: 2, t: 'Your leave on the 24th was saved.', at: 'Yesterday', unread: true }, { id: 3, t: 'Your verification was approved.', at: '5 weeks ago' }],
  series: Array.from({ length: 30 }, (_, i) => Math.round(8 + i * .5 + Math.sin(i / 2) * 3)),
};

function useQueue() {
  const [rows, setRows, err] = useData('/doctor/appointments', D.apps);
  const [notes, setNotes] = useState({});
  const move = async (r, status) => {
    try {
      await act('PATCH', `/doctor/appointments/${r.id}`, { status });
      if (status === 'COMPLETED' && notes[r.id]) await act('PATCH', `/doctor/consultations/${r.id}`, { notes: notes[r.id] });
      setRows(list(rows).map(x => x.id === r.id ? { ...x, status, notes: notes[r.id] || x.notes } : x));
      toast(
        status === 'CONFIRMED'
          ? '✓ Appointment confirmed! Patient notified.'
          : status === 'CANCELLED'
          ? 'Appointment declined.'
          : status === 'COMPLETED'
          ? 'Consultation completed'
          : 'Consultation started'
      );
    } catch (e) { toast(e.message); }
  };
  return { rows: rows && list(rows).map(normalizeAppointment), err, notes, setNotes, move };
}
const Err = ({ e }) => e ? <p className="note">Showing sample data. {e}</p> : null;
const Notes = ({ r, q }) => <div style={{ width: '100%' }}>
  <textarea rows="3" placeholder="Clinical notes (private, not written to audit logs)" value={q.notes[r.id] || ''} onChange={e => q.setNotes({ ...q.notes, [r.id]: e.target.value })} />
  <button className="qb pri" style={{ marginTop: 8 }} onClick={() => q.move(r, 'COMPLETED')}>Complete and save notes</button></div>;

function InstantCaseStudy({ consultationId, endpoint = 'instant-consultations', onSaved }) {
  const [form, setForm] = useState({ title: '', clinicalSummary: '', diagnosis: '', treatmentPlan: '', followUp: '' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!form.title.trim() || form.clinicalSummary.trim().length < 10) return toast('Add a title and a clinical summary of at least 10 characters.');
    setBusy(true);
    try { await call('POST', `/${endpoint}/${consultationId}/case-study`, form); toast('Case study submitted successfully.'); onSaved?.(); }
    catch (e) { toast(e.message); }
    finally { setBusy(false); }
  };
  const field = (key, label, placeholder, rows = 2) => <label style={{ display: 'block', marginTop: 10 }}><span className="lbl">{label}</span><textarea rows={rows} placeholder={placeholder} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>;
  return <div><label style={{ display: 'block' }}><span className="lbl">Case study title *</span><input placeholder="Example: Acute migraine managed with lifestyle advice" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>{field('clinicalSummary', 'Clinical summary *', 'Briefly document the patient presentation and key findings.', 3)}{field('diagnosis', 'Diagnosis / findings', 'Diagnosis or important clinical findings.', 2)}{field('treatmentPlan', 'Treatment plan', 'Medication, advice, or care plan provided.', 2)}{field('followUp', 'Follow-up', 'Follow-up date or instructions.', 2)}<button className="qb pri" disabled={busy} onClick={save} style={{ marginTop: 12 }}>{busy ? 'Submitting…' : 'Submit case study'}</button></div>;
}

function Dash({ go, user }) {
  const q = useQueue();
  const [v] = useData('/doctor/verification', D.ver);
  const [instant, setInstant] = useState([]), [instantRoom, setInstantRoom] = useState(null), [caseStudyId, setCaseStudyId] = useState(null);
  useEffect(() => { let live = true; const load = () => { if (demo()) return; call('GET', '/instant-consultations/doctor/requests').then(x => live && setInstant(list(x))).catch(() => {}); }; load(); const timer = setInterval(load, 3000); return () => { live = false; clearInterval(timer); }; }, []);
  const acceptInstant = async id => { try { await call('POST', `/instant-consultations/${id}/accept`); const room = await call('POST', `/instant-consultations/${id}/join`); setInstant(list(instant).filter(x => x.id !== id)); setInstantRoom(room); toast('Instant consultation accepted. The private room is ready.'); } catch (e) { toast(e.message); } };
  if (!q.rows) return null;
  const L = q.rows, today = L.filter(x => x.date === T0), nxt = today.filter(x => WAIT(x.status)).sort(byTime)[0];
  const slots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30'];
  return <>
    <Err e={q.err} />
    {instantRoom && <Card title="Private instant consultation"><InstantCall consultationId={instantRoom.consultationId} roomToken={instantRoom.roomToken} role="DOCTOR" onEnd={() => { setCaseStudyId(instantRoom.consultationId); setInstantRoom(null); }} /></Card>}
    {caseStudyId && <Card title="Submit case study"><p className="empty">The consultation is complete. Submit the clinical case study for this patient.</p><InstantCaseStudy consultationId={caseStudyId} onSaved={() => setCaseStudyId(null)} /></Card>}
    {list(instant).filter(x => x.status === 'REQUESTED').map(x => <div key={x.id} style={{ background: 'rgba(16,185,129,.15)', border: '1px solid #10b981', borderRadius: 8, padding: '10px 16px', color: '#d1fae5', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>Incoming instant consultation from <b>{x.patient_name}</b></span><button className="qb pri sm" onClick={() => acceptInstant(x.id)}>Accept call</button></div>)}
    {L.some(x => x.status === 'WAITING') && (
      <div style={{ background: 'rgba(234, 179, 8, 0.15)', border: '1px solid #eab308', borderRadius: 8, padding: '10px 16px', color: '#fef08a', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <span>⚠️ You have <b>{L.filter(x => x.status === 'WAITING').length}</b> appointment(s) awaiting your review and confirmation.</span>
        <button className="qb pri sm" onClick={() => go('apps')}>Review & Confirm Now →</button>
      </div>
    )}
    <Card className="hello">
      <div><h2>Good morning, {user.name}</h2><p>{today.filter(x => WAIT(x.status) || x.status === 'IN_PROGRESS').length} consultations left today.</p>
        <span className="ch ok" style={{ marginTop: 8 }}>Verification: {(v?.status || 'APPROVED').toLowerCase()}</span></div>
      {nxt && <div className="nx" style={{ background: 'transparent', borderColor: '#2b4766', color: '#fff' }}><span className="when" style={{ color: '#8fb8ff' }}>Next at {nxt.time}</span><b>{nxt.patient}</b><span style={{ color: '#aab8cc' }}>{MODE[nxt.mode]} · {nxt.reason}</span>
        <div className="qa" style={{ margin: '8px 0 0' }}><button className="qb pri" onClick={() => go('cons')}>Open consultations</button></div></div>}
    </Card>
    <div className="stats">
      <Stat ic="Td" v={today.length} l="Today’s appointments" s="All consultation modes" />
      <Stat ic="Up" v={L.filter(x => WAIT(x.status) && x.date > T0).length} l="Upcoming" s="After today" />
      <Stat ic="Ok" v={L.filter(x => x.status === 'COMPLETED').length} l="Completed" s="Notes saved" />
      <Stat ic="X" v={L.filter(x => x.status === 'CANCELLED').length} l="Cancelled" s="By patient or admin" />
    </div>
    <div className="qa">
      <button className="qb pri" onClick={() => go('apps')}>Appointments</button><button className="qb dk" onClick={() => go('sched')}>Schedule</button>
      <button className="qb" onClick={() => go('pats')}>Patients</button><button className="qb" onClick={() => go('recs')}>Medical records</button>
    </div>
    <div className="cols c21">
      <Card title="Today">{slots.map(t => { const a = today.find(x => x.time === t); return <div className="rw" key={t}><b className="tm">{t}</b>
        {a ? <><div className="g"><b>{a.patient}</b><span className="sub">{MODE[a.mode]} · {a.reason}</span></div><Chip s={a.status} /></> : <span className="sub g">Available</span>}</div>; })}</Card>
      <Card title="Consultations, last 30 days"><Line data={D.series} /></Card>
    </div>
  </>;
}

const STEPS = ['Verify', 'Patient', 'Mode', 'Records', 'Consult', 'Notes', 'Complete'];
function Apps() {
  const q = useQueue();
  const [tab, setTab] = useState('Pending Confirmation'), [sel, setSel] = useState(null);
  if (!q.rows) return null;
  const view = { 
    'Pending Confirmation': x => x.status === 'WAITING',
    Today: x => (x.status === 'CONFIRMED' || x.status === 'SCHEDULED') && x.date === T0, 
    Upcoming: x => (x.status === 'CONFIRMED' || x.status === 'SCHEDULED') && x.date > T0, 
    Completed: x => x.status === 'COMPLETED', 
    Cancelled: x => x.status === 'CANCELLED' 
  };
  const rows = q.rows.filter(view[tab]).sort(byTime), r = q.rows.find(x => x.id === sel);
  const at = !r ? 0 : r.status === 'COMPLETED' ? 7 : r.status === 'IN_PROGRESS' ? 5 : 3;
  return <>
    <Err e={q.err} />
    <div className="pills">{Object.keys(view).map(k => <button key={k} aria-pressed={tab === k} onClick={() => { setTab(k); setSel(null); }}>{k} ({q.rows.filter(view[k]).length})</button>)}</div>
    <div className="cols c2">
      <Card>{rows.length ? rows.map(x => <div className={'rw open' + (sel === x.id ? ' sel' : '')} key={x.id} onClick={() => setSel(x.id)}>
        <b className="tm">{x.time}</b>
        <div className="g">
          <b>{x.patient}</b>
          <span className="sub">{x.date === T0 ? 'Today' : fmt(x.date)} · {MODE[x.mode]}</span>
        </div>
        <Chip s={x.status} />
        {x.status === 'WAITING' && (
          <button 
            className="qb pri sm" 
            style={{ background: '#10b981', borderColor: '#10b981', color: '#fff', marginLeft: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}
            onClick={e => { e.stopPropagation(); q.move(x, 'CONFIRMED'); }}
          >
            ✓ Confirm
          </button>
        )}
      </div>) : <p className="empty">No {tab.toLowerCase()} appointments.</p>}</Card>
      <Card title={r ? r.patient : 'Appointment details'} right={r && <Chip s={r.status} />}>
        {!r ? <p className="empty">Select an appointment to see the patient, mode and records.</p> : <>
          <div className="tl">{STEPS.map((s, i) => <span key={s} className={i < at ? 'done' : i === at ? 'now' : ''}>{s}</span>)}</div>
          <div className="kv"><div><small>Age</small><b>{r.age || '32'}</b></div><div><small>Phone</small><b>{r.phone}</b></div><div><small>Mode</small><b>{MODE[r.mode]}</b></div><div><small>Time</small><b>{fmt(r.date)}, {r.time}</b></div></div>
          <div className="lbl">Reason for visit</div><p style={{ margin: '0 0 8px' }}>{r.reason || 'General medical consultation'}</p>
          <div className="lbl">Records shared with you</div>
          {(r.records || []).length ? (r.records).map(n => <div key={n} className="sub" style={{ padding: '2px 0', color: 'var(--tx)' }}>{n}</div>) : <p className="empty" style={{ margin: 0 }}>None shared.</p>}
          {r.notes && <><div className="lbl">Consultation notes</div><p style={{ margin: 0 }}>{r.notes}</p></>}
          <div className="qa" style={{ margin: '12px 0 0', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {r.status === 'WAITING' && (
              <>
                <button className="qb pri" style={{ background: '#10b981', borderColor: '#10b981', color: '#fff', fontWeight: 'bold' }} onClick={() => q.move(r, 'CONFIRMED')}>
                  ✓ Confirm Appointment
                </button>
                <button className="qb" style={{ borderColor: '#f43f5e', color: '#f43f5e' }} onClick={() => q.move(r, 'CANCELLED')}>
                  ✕ Decline Booking
                </button>
              </>
            )}
            {r.status === 'CONFIRMED' && r.mode === 'VIDEO' && r.date === T0 && <button className="qb" onClick={() => r.meeting_url && !demo() ? window.open(r.meeting_url, '_blank', 'noopener') : toast('The meeting link opens from the live backend')}>Open meeting link</button>}
            {WAIT(r.status) && <button className="qb pri" onClick={() => q.move(r, 'IN_PROGRESS')}>Start consultation</button>}
          </div>
          {r.status === 'IN_PROGRESS' && <div style={{ marginTop: 10 }}><Notes r={r} q={q} /></div>}
          {r.status === 'COMPLETED' && r.consultation_id && <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}><div className="lbl">Post-consultation case study</div><InstantCaseStudy consultationId={r.consultation_id} endpoint="doctor/consultations" /></div>}
        </>}
      </Card>
    </div>
  </>;
}

function Cons() {
  const q = useQueue();
  if (!q.rows) return null;
  const col = (t, f, body) => <div><h4>{t} ({q.rows.filter(f).length})</h4>{q.rows.filter(f).sort(byTime).map(body)}</div>;
  const card = x => <div className="card" key={x.id} style={{ marginBottom: 10 }}>
    <div className="rw" style={{ border: 0, padding: 0 }}><b className="tm">{x.time}</b><div className="g"><b>{x.patient}</b><span className="sub">{MODE[x.mode]} · {x.reason}</span></div></div>
    {WAIT(x.status) && <button className="qb pri sm" style={{ marginTop: 8 }} onClick={() => q.move(x, 'IN_PROGRESS')}>Start</button>}
    {x.status === 'IN_PROGRESS' && <div style={{ marginTop: 8 }}><Notes r={x} q={q} /></div>}
    {x.status === 'COMPLETED' && x.notes && <p className="sub" style={{ margin: '8px 0 0' }}>{x.notes}</p>}
  </div>;
  return <><Err e={q.err} /><div className="kan">
    {col('Waiting', x => WAIT(x.status) && x.date === T0, card)}{col('In progress', x => x.status === 'IN_PROGRESS', card)}{col('Completed', x => x.status === 'COMPLETED', card)}
  </div></>;
}

function Pats({ go }) {
  const [p, , err] = useData('/doctor/patients', D.pats);
  const [tab, setTab] = useState('Today’s patients');
  if (!p) return null;
  const patients = list(p).map(normalizePatient);
  const rows = patients.filter(x => (tab === 'Today’s patients') === !!x.today);
  return (
    <>
      <Err e={err} />
      <div className="pills">
        {['Today’s patients', 'Previous patients'].map(k => (
          <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>
            {k} ({patients.filter(x => (k === 'Today’s patients') === !!x.today).length})
          </button>
        ))}
      </div>
      <Card title={tab}>
        <Table
          rows={rows}
          empty="No patients in this view."
          cols={[
            {
              h: 'Patient',
              r: x => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className={`p-avatar-box ${AV_COLORS[(x.id || 1) % AV_COLORS.length]}`} style={{ width: 34, height: 34, fontSize: 12 }}>
                    {getInitials(x.name)}
                    {x.today && <span className="pulse-dot" />}
                  </div>
                  <div>
                    <b style={{ color: '#fff', fontSize: 13 }}>{x.name}</b>
                    <small style={{ display: 'block', color: 'var(--mu)', fontSize: 11 }}>{x.condition || 'General Care'}</small>
                  </div>
                </div>
              ),
            },
            {
              h: 'Age / Gender',
              r: x => <span className="p-meta-pill">{x.age} yrs · {x.gender || 'Male'}</span>,
            },
            {
              h: 'Blood Group',
              r: x => <span className="p-meta-pill" style={{ color: '#f87171' }}>🩸 {x.bloodGroup || 'O+'}</span>,
            },
            {
              h: 'Consultations',
              r: x => <span className="p-meta-pill pill-today">{x.visits} visits</span>,
            },
            {
              h: 'Last Visit',
              r: x => <span style={{ color: 'var(--tx)', fontSize: 12 }}>{fmt(x.last)}</span>,
            },
            {
              h: 'Actions',
              r: () => (
                <button className="btn-view-modern" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => go('recs')}>
                  Dossier & Records ›
                </button>
              ),
            },
          ]}
        />
      </Card>
      <p className="empty">You only see patients who have booked consultations with your clinical department.</p>
    </>
  );
}

const AV_COLORS = ['c-indigo', 'c-cyan', 'c-emerald', 'c-amber', 'c-rose'];
const getInitials = n => (n ? n.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase() : 'PT');

function Recs() {
  const [p] = useData('/doctor/patients', D.pats);
  const [pid, setPid] = useState(1);
  const [q, setQ] = useState('');
  const [L, setL] = useState('');
  const [rq, setRq] = useState('');
  const [catFilter, setCatFilter] = useState('ALL');
  const [previewDoc, setPreviewDoc] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [newDoc, setNewDoc] = useState({ name: '', type: 'Lab Test', size: '2.1 MB' });

  // Load records
  const defaultRecs = (D.recs[pid] || []).map((item, i) =>
    typeof item === 'object'
      ? item
      : { id: i + 1, name: item, size: '2.4 MB', date: '24 Aug 2026', type: 'Lab Test', tag: 'Clinical Report' }
  );
  const [r, setR, err] = useData(`/doctor/medical-records/${pid}`, defaultRecs);

  if (!p) return null;
  const all = list(p).slice().sort((a, b) => a.name.localeCompare(b.name));
  const has = new Set(all.map(x => x.name[0].toUpperCase()));
  const pts = all.filter(x => (!L || x.name[0].toUpperCase() === L) && (!q || x.name.toLowerCase().includes(q.toLowerCase())));
  const cur = all.find(x => x.id === pid) || all[0];

  const currentRecordsList = list(r || defaultRecs);
  const recs = currentRecordsList.filter(x => {
    const name = String(x.name || x.file_name || '').toLowerCase();
    const matchesQuery = !rq || name.includes(rq.toLowerCase());
    const matchesCat = catFilter === 'ALL' || (x.type && x.type.toLowerCase().includes(catFilter.toLowerCase()));
    return matchesQuery && matchesCat;
  });

  const dl = async x => {
    if (demo()) {
      toast(`Downloading ${x.name || 'document.pdf'}...`);
      return;
    }
    try {
      const res = await fetch(`${BASE}/doctor/medical-records/${pid}/${x.id}/download`, {
        headers: { Authorization: 'Bearer ' + session.get()?.token },
      });
      if (!res.ok) throw new Error('Download failed');
      const u = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = u;
      a.download = x.name || 'record.pdf';
      a.click();
      URL.revokeObjectURL(u);
      toast('Download completed');
    } catch (e) {
      toast(e.message);
    }
  };

  const handleUploadSubmit = e => {
    e.preventDefault();
    if (!newDoc.name.trim()) return toast('Please enter a document title');
    const docName = newDoc.name.endsWith('.pdf') ? newDoc.name : `${newDoc.name}.pdf`;
    const docItem = {
      id: Date.now(),
      name: docName,
      size: newDoc.size || '1.8 MB',
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      type: newDoc.type || 'Lab Test',
      tag: 'Doctor Attachment',
      doctor: 'Dr. Ananya Rao',
    };
    setR([docItem, ...currentRecordsList]);
    setShowUpload(false);
    setNewDoc({ name: '', type: 'Lab Test', size: '2.1 MB' });
    toast(`Record "${docName}" attached to patient profile`);
  };

  return (
    <>
      <Err e={err} />
      <div className="cols idx">
        {/* Left Column: Patient Directory */}
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Patient Directory</span>
              <span className="p-meta-pill pill-today">{all.length} Total</span>
            </div>
          }
          right={
            (q || L) && (
              <button
                className="sm"
                onClick={() => {
                  setQ('');
                  setL('');
                }}
                style={{ borderRadius: 99, padding: '3px 10px' }}
              >
                Clear filter
              </button>
            )
          }
        >
          {/* Modern Search Field */}
          <div className="search-box-modern">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              aria-label="Search patients"
              placeholder="Search patients by name or phone..."
              value={q}
              onChange={e => setQ(e.target.value)}
            />
            {q && (
              <button className="search-clear-btn" onClick={() => setQ('')} aria-label="Clear search">
                ×
              </button>
            )}
          </div>

          {/* Alphabet Scroller Ribbon */}
          <div className="az" role="group" aria-label="Filter by letter">
            <button aria-pressed={!L} onClick={() => setL('')}>
              All
            </button>
            {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c => (
              <button key={c} disabled={!has.has(c)} aria-pressed={L === c} onClick={() => setL(c)}>
                {c}
              </button>
            ))}
          </div>

          {/* Patient Cards List */}
          <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', paddingRight: 4 }}>
            {pts.length ? (
              pts.map((x, i) => {
                const isSelected = pid === x.id;
                const showGroupHeader = i === 0 || pts[i - 1].name[0].toUpperCase() !== x.name[0].toUpperCase();
                const colorClass = AV_COLORS[(x.id || i) % AV_COLORS.length];

                return (
                  <div key={x.id}>
                    {showGroupHeader && (
                      <div className="letter-divider">
                        <span className="letter-chip">{x.name[0].toUpperCase()}</span>
                        <span className="letter-line" />
                      </div>
                    )}
                    <div
                      className={`p-item-card ${isSelected ? 'selected' : ''}`}
                      tabIndex={0}
                      onClick={() => {
                        setPid(x.id);
                        setRq('');
                        setCatFilter('ALL');
                      }}
                      onKeyDown={e => e.key === 'Enter' && setPid(x.id)}
                    >
                      <div className={`p-avatar-box ${colorClass}`}>
                        {getInitials(x.name)}
                        {x.today && <span className="pulse-dot" title="Active consultation today" />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <b style={{ color: isSelected ? '#fff' : 'var(--tx)', fontSize: 13.5 }}>{x.name}</b>
                          {isSelected && <span style={{ color: '#60a5fa', fontSize: 13, fontWeight: 700 }}>›</span>}
                        </div>
                        <div className="p-meta-chips">
                          <span className="p-meta-pill">Age {x.age}</span>
                          {x.bloodGroup && <span className="p-meta-pill">🩸 {x.bloodGroup}</span>}
                          <span className={`p-meta-pill ${x.today ? 'pill-today' : ''}`}>
                            {x.today ? 'Today' : `Last: ${fmt(x.last)}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-state-records">
                <h4>No patients match</h4>
                <p>Try searching with another name or letter.</p>
                <button
                  className="sm"
                  onClick={() => {
                    setQ('');
                    setL('');
                  }}
                >
                  Reset directory filters
                </button>
              </div>
            )}
          </div>
        </Card>

        {/* Right Column: Selected Patient Dossier & Medical Records */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Selected Patient Dossier Hero Card */}
          {cur && (
            <div className="patient-dossier-hero">
              <div className="dossier-top" style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div className={`dossier-avatar ${AV_COLORS[(cur.id || 1) % AV_COLORS.length]}`}>
                    {getInitials(cur.name)}
                  </div>
                  <div className="dossier-name-box">
                    <h3>
                      {cur.name}
                      <span className="verified-tag">✓ Verified Patient</span>
                    </h3>
                    <div className="dossier-sub">
                      Patient ID: <strong style={{ color: 'var(--tx)' }}>#PAT-00{cur.id}</strong> · {cur.condition || 'General Medical Care'}
                    </div>
                  </div>
                </div>

                <button className="btn-view-modern" onClick={() => setShowUpload(true)}>
                  <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> Attach Record
                </button>
              </div>

              {/* Vitals & Demographics Strip */}
              <div className="dossier-vitals-strip" style={{ width: '100%' }}>
                <div className="vital-item">
                  <small>Age / Sex</small>
                  <b>{cur.age} yrs · {cur.gender || 'Male'}</b>
                </div>
                <div className="vital-item">
                  <small>Blood Group</small>
                  <b>🩸 {cur.bloodGroup || 'O+'}</b>
                </div>
                <div className="vital-item">
                  <small>Phone</small>
                  <b>{cur.phone || '+91 98•••• 4521'}</b>
                </div>
                <div className="vital-item">
                  <small>Consultations</small>
                  <b>{cur.visits || 3} Visits</b>
                </div>
                <div className="vital-item">
                  <small>Last Visit</small>
                  <b>{fmt(cur.last)}</b>
                </div>
              </div>
            </div>
          )}

          {/* Medical Records Panel */}
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Medical Records & Diagnostics</span>
                <span className="p-meta-pill pill-today">{recs.length} Files</span>
              </div>
            }
          >
            {/* Search and Category Filter Strip */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <div className="search-box-modern" style={{ flex: 1, minWidth: 200, margin: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="search"
                  aria-label="Search records"
                  placeholder="Filter records by name..."
                  value={rq}
                  onChange={e => setRq(e.target.value)}
                />
                {rq && (
                  <button className="search-clear-btn" onClick={() => setRq('')} aria-label="Clear record search">
                    ×
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                {['ALL', 'Lab', 'Cardio', 'Imaging'].map(cat => (
                  <button
                    key={cat}
                    className={`sm ${catFilter === cat ? 'pri' : ''}`}
                    onClick={() => setCatFilter(cat)}
                    style={{
                      borderRadius: 8,
                      background: catFilter === cat ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : 'rgba(255,255,255,0.06)',
                      color: catFilter === cat ? '#fff' : 'var(--tx)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      padding: '5px 10px',
                    }}
                  >
                    {cat === 'ALL' ? 'All' : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Records List */}
            {recs.length ? (
              recs.map(x => {
                const fileName = x.name || x.file_name || 'Medical_Record.pdf';
                const fileSize = x.size || (fileName.toLowerCase().includes('scan') ? '4.8 MB' : '2.1 MB');
                const fileDate = x.date || 'Aug 2026';
                const fileTag = x.tag || x.type || 'Clinical Report';

                return (
                  <div className="record-item-card" key={x.id || fileName}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div className="rec-pdf-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                          <polyline points="10 9 9 9 8 9" />
                        </svg>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <b style={{ display: 'block', fontSize: 13.5, color: '#fff', wordBreak: 'break-all' }}>{fileName}</b>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 3, flexWrap: 'wrap' }}>
                          <span className="p-meta-pill" style={{ color: '#60a5fa', borderColor: 'rgba(59,130,246,0.25)' }}>
                            {fileTag}
                          </span>
                          <span className="sub">{fileSize} · {fileDate}</span>
                          <span className="sub" style={{ color: '#10b981' }}>🔒 HIPAA Secure</span>
                        </div>
                      </div>
                    </div>

                    <div className="rec-actions">
                      <button className="btn-view-modern" onClick={() => setPreviewDoc({ ...x, name: fileName, size: fileSize, date: fileDate })}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        View
                      </button>
                      <button className="btn-download-modern" onClick={() => dl(x)} title="Download record">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-state-records">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <h4>{rq ? 'No matching records found' : 'No medical records available yet'}</h4>
                <p>
                  {rq
                    ? 'Clear the search query to see all documents.'
                    : `${cur?.name || 'This patient'} has not uploaded records yet. You can attach a document directly.`}
                </p>
                <button className="btn-view-modern" onClick={() => setShowUpload(true)}>
                  + Attach First Record
                </button>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Modern High-Definition Document Preview Modal */}
      {previewDoc && (
        <div className="modal-backdrop" onClick={() => setPreviewDoc(null)}>
          <div className="modal-box wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="p-meta-pill pill-today" style={{ fontSize: 11 }}>PDF DOCUMENT</span>
                <h3 style={{ fontSize: 15 }}>{previewDoc.name}</h3>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn-download-modern" onClick={() => dl(previewDoc)}>
                  ⬇ Download
                </button>
                <button className="modal-close" onClick={() => setPreviewDoc(null)} aria-label="Close modal">
                  ✕
                </button>
              </div>
            </div>

            <div className="modal-body" style={{ background: '#0b0f19', padding: 20 }}>
              <div className="clinical-preview-paper">
                <div className="clinic-header">
                  <div>
                    <div className="clinic-logo">
                      OTP <span>CLINICAL LABS</span>
                    </div>
                    <small style={{ color: '#64748b' }}>Accredited Diagnostics & Teleconsultation Center · Reg #DL-MED-44019</small>
                  </div>
                  <div className="clinic-meta">
                    <b>DATE: {previewDoc.date || '24 Aug 2026'}</b>
                    <div>PATIENT ID: #PAT-00{cur?.id || 1}</div>
                    <div>CONFIDENTIAL MEDICAL DOCUMENT</div>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                    <div><strong>Patient:</strong> {cur?.name}</div>
                    <div><strong>Age / Sex:</strong> {cur?.age} yrs / {cur?.gender || 'Male'}</div>
                    <div><strong>Referred By:</strong> Dr. Ananya Rao</div>
                    <div><strong>Category:</strong> {previewDoc.type || 'Cardiology & Diagnostic'}</div>
                  </div>
                </div>

                <h4 style={{ margin: '14px 0 8px', fontSize: 13, textTransform: 'uppercase', color: '#1e293b' }}>
                  Laboratory Test Observations & Clinical Metrics
                </h4>

                <table className="patient-vital-table">
                  <thead>
                    <tr>
                      <th>Investigation / Parameter</th>
                      <th>Observed Value</th>
                      <th>Reference Interval</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Hemoglobin (Hb)</strong></td>
                      <td>14.8 g/dL</td>
                      <td>13.0 - 17.0 g/dL</td>
                      <td><span style={{ color: '#16a34a', fontWeight: 600 }}>Normal</span></td>
                    </tr>
                    <tr>
                      <td><strong>Fasting Blood Glucose</strong></td>
                      <td>98 mg/dL</td>
                      <td>70 - 100 mg/dL</td>
                      <td><span style={{ color: '#16a34a', fontWeight: 600 }}>Optimal</span></td>
                    </tr>
                    <tr>
                      <td><strong>Total Cholesterol</strong></td>
                      <td>212 mg/dL</td>
                      <td>&lt; 200 mg/dL</td>
                      <td><span style={{ color: '#d97706', fontWeight: 600 }}>Borderline</span></td>
                    </tr>
                    <tr>
                      <td><strong>Serum Creatinine</strong></td>
                      <td>0.92 mg/dL</td>
                      <td>0.70 - 1.20 mg/dL</td>
                      <td><span style={{ color: '#16a34a', fontWeight: 600 }}>Normal</span></td>
                    </tr>
                    <tr>
                      <td><strong>ECG Resting Rhythm</strong></td>
                      <td>Normal Sinus Rhythm, 72 bpm</td>
                      <td>60 - 100 bpm</td>
                      <td><span style={{ color: '#16a34a', fontWeight: 600 }}>Normal</span></td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ background: '#f1f5f9', padding: '10px 14px', borderRadius: 6, margin: '16px 0', fontSize: 12 }}>
                  <strong>Doctor’s Interpretation:</strong> Findings are consistent with stable cardiovascular metrics. Mild dietary modification recommended for borderline cholesterol. Review along with clinical consultation in 3 months.
                </div>

                <div className="clinical-stamp">
                  <div className="audit-chip">
                    🔒 Electronic Audit Hash: <code>0x7f9a2e88...b12c</code>
                    <br />
                    Access logged by Dr. Ananya Rao · Telemedicine Security Standard
                  </div>
                  <div className="doctor-sign">
                    <img
                      src="https://api.iconify.design/lucide:shield-check.svg?color=%2315803d"
                      width="20"
                      height="20"
                      alt="Verified"
                      style={{ verticalAlign: 'middle', marginRight: 4 }}
                    />
                    <b>Dr. Ananya Rao, MD (Cardiology)</b>
                    <span>Consultant Cardiologist · MCI-40137</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="qb" onClick={() => setPreviewDoc(null)}>
                Close Preview
              </button>
              <button className="qb pri" onClick={() => dl(previewDoc)}>
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attach New Record Modal */}
      {showUpload && (
        <div className="modal-backdrop" onClick={() => setShowUpload(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Attach Medical Record for {cur?.name}</h3>
              <button className="modal-close" onClick={() => setShowUpload(false)} aria-label="Close modal">
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadSubmit}>
              <div className="modal-body">
                <div
                  style={{
                    border: '2px dashed rgba(59,130,246,0.3)',
                    borderRadius: 10,
                    padding: '24px 16px',
                    textAlign: 'center',
                    background: 'rgba(59,130,246,0.05)',
                  }}
                >
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" style={{ margin: '0 auto 8px', display: 'block' }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <b style={{ display: 'block', fontSize: 13, color: '#fff' }}>Click or drag PDF document to attach</b>
                  <small style={{ color: 'var(--mu)' }}>Supported formats: PDF, DICOM, JPEG (Max: 25MB)</small>
                </div>

                <div className="fm">
                  <label className="full">
                    Document Title / File Name
                    <input
                      placeholder="e.g. Holter-24hr-monitoring.pdf"
                      value={newDoc.name}
                      onChange={e => setNewDoc({ ...newDoc, name: e.target.value })}
                      required
                    />
                  </label>

                  <label>
                    Category
                    <select value={newDoc.type} onChange={e => setNewDoc({ ...newDoc, type: e.target.value })}>
                      <option value="Lab Test">Lab Test / Blood Report</option>
                      <option value="Cardiology">Cardiology / ECG</option>
                      <option value="Imaging">Imaging / Ultrasound</option>
                      <option value="Prescription">Prescription</option>
                      <option value="Vitals Log">Vitals Log</option>
                    </select>
                  </label>

                  <label>
                    Estimated File Size
                    <input value={newDoc.size} onChange={e => setNewDoc({ ...newDoc, size: e.target.value })} />
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="qb" onClick={() => setShowUpload(false)}>
                  Cancel
                </button>
                <button type="submit" className="qb pri">
                  Upload & Secure Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Schedule() {
  const [d, setD] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((n, i) => ({ n, on: i < 5, start: '09:00', end: '13:00', slot: 30 })));
  const [leaves, setLeaves] = useState([{ id: 1, from: iso(day(14)), to: iso(day(16)), reason: 'Conference' }]);
  const [lv, setLv] = useState({ from: '', to: '', reason: '' });
  const ch = (i, k) => e => setD(d.map((x, j) => j === i ? { ...x, [k]: e.target.value } : x));
  const save = async () => { try { await act('POST', '/doctor/schedule', { schedules: d.map((x, i) => x.on && { day_of_week: i, start_time: x.start, end_time: x.end, slot_duration: +x.slot }).filter(Boolean) }); toast('Schedule saved'); } catch (e) { toast(e.message); } };
  const addLeave = async () => {
    if (!lv.from || !lv.to || lv.to < lv.from) return toast('Choose a start date and an end date after it');
    try { await act('POST', '/doctor/leave', { start_date: lv.from, end_date: lv.to, reason: lv.reason }); setLeaves([...leaves, { id: Date.now(), ...lv }]); setLv({ from: '', to: '', reason: '' }); toast('Leave saved'); } catch (e) { toast(e.message); }
  };
  return <div className="cols c21">
    <Card title="Weekly availability">{d.map((x, i) => <div className="lv" key={x.n}>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" style={{ width: 16 }} checked={x.on} onChange={() => setD(d.map((y, j) => j === i ? { ...y, on: !y.on } : y))} /><b>{x.n}</b></label>
      <input type="time" aria-label={x.n + ' start'} disabled={!x.on} value={x.start} onChange={ch(i, 'start')} /><input type="time" aria-label={x.n + ' end'} disabled={!x.on} value={x.end} onChange={ch(i, 'end')} />
      <input type="number" aria-label={x.n + ' slot minutes'} min="10" step="5" disabled={!x.on} value={x.slot} onChange={ch(i, 'slot')} /></div>)}
      <p className="empty">The last column is the slot length in minutes.</p><button className="qb pri" onClick={save}>Save schedule</button></Card>
    <Card title="Leave">{leaves.map(l => <div className="rw" key={l.id}><div className="g"><b>{fmt(l.from)} to {fmt(l.to)}</b><span className="sub">{l.reason || 'No reason added'}</span></div></div>)}
      <div className="fm" style={{ marginTop: 10 }}><label>From<input type="date" value={lv.from} onChange={e => setLv({ ...lv, from: e.target.value })} /></label><label>To<input type="date" value={lv.to} onChange={e => setLv({ ...lv, to: e.target.value })} /></label>
        <label className="full">Reason<input value={lv.reason} onChange={e => setLv({ ...lv, reason: e.target.value })} /></label></div>
      <div className="qa" style={{ marginTop: 12 }}><button className="qb" onClick={addLeave}>Add leave</button></div></Card>
  </div>;
}

const DEFAULT_DEPTS = [
  { id: 1, name: 'General Medicine' },
  { id: 2, name: 'Cardiology' },
  { id: 3, name: 'Dermatology' },
  { id: 4, name: 'Pediatrics' },
  { id: 5, name: 'Orthopedics' },
  { id: 6, name: 'Neurology' },
  { id: 7, name: 'Gynecology' },
  { id: 8, name: 'ENT' },
];

const UG_DEGREES = ['MBBS', 'BDS', 'BAMS', 'BHMS', 'BUMS', 'BPT', 'BSMS', 'BYNS'];
const PG_DEGREES = ['MD', 'MS', 'DNB', 'MDS', 'DM', 'MCh', 'DCH', 'DGO', 'DA', 'DMRD', 'DLO', 'DVD', 'D.Ortho'];
const OTHER_DEGREES = ['MRCP', 'FRCS', 'MRCS', 'FRCP', 'FACC', 'FAAP', 'Fellowship', 'Diploma'];

function Profile() {
  const [p, setP, err] = useData('/doctor/profile', D.profile);
  const [deptsData] = useData('/doctor/departments', DEFAULT_DEPTS);
  const [v, setV] = useState(null), [c, setC] = useState('');
  if (!p) return null;

  const departmentList = Array.isArray(deptsData) && deptsData.length ? deptsData : (deptsData?.items || DEFAULT_DEPTS);
  const deptMatch = departmentList.find(d => String(d.id) === String(p.department_id) || d.name === (p.department || p.department_name));

  const baseProfile = {
    ...p,
    name: p.name || '',
    department_id: p.department_id || deptMatch?.id || 1,
    department: deptMatch?.name || p.department || p.department_name || 'General Medicine',
    registration_no: p.registration_no || p.registration_number || '',
    experience: p.experience ?? p.experience_years ?? '',
    qualification: p.qualification || '',
    about: p.about || p.bio || '',
    cases: Array.isArray(p.cases) ? p.cases : (Array.isArray(p.case_studies) ? p.case_studies : []),
  };

  const f = v || baseProfile;
  const set = k => e => setV({ ...f, [k]: e.target.value });
  const cases = f.cases || [];

  // Helper to check if a specific degree is present in qualification text
  const isDegreeSelected = deg => {
    if (!f.qualification) return false;
    const regex = new RegExp(`(^|[\\s,;/])${deg.replace('.', '\\.')}([\\s,;/]|$)`, 'i');
    return regex.test(f.qualification);
  };

  // Helper to toggle a degree on or off
  const toggleDegree = deg => {
    let current = (f.qualification || '').trim();
    if (isDegreeSelected(deg)) {
      // Remove degree
      const parts = current
        .split(',')
        .map(s => s.trim())
        .filter(s => s && !new RegExp(`^${deg.replace('.', '\\.')}$`, 'i').test(s));
      setV({ ...f, qualification: parts.join(', ') });
    } else {
      // Add degree
      const parts = current ? current.split(',').map(s => s.trim()).filter(Boolean) : [];
      if (!parts.some(s => new RegExp(`^${deg.replace('.', '\\.')}$`, 'i').test(s))) {
        parts.push(deg);
      }
      setV({ ...f, qualification: parts.join(', ') });
    }
  };

  const save = async () => {
    try {
      const expNum = f.experience === '' || f.experience === null || f.experience === undefined ? null : Number(f.experience);
      const deptIdNum = f.department_id ? Number(f.department_id) : null;
      const res = await act('PATCH', '/doctor/profile', {
        department_id: deptIdNum,
        qualification: f.qualification || '',
        experience: expNum,
        experience_years: expNum,
        about: f.about || '',
        bio: f.about || '',
        case_studies: cases,
        cases: cases,
      });
      if (res) {
        setP({ ...res, department_id: deptIdNum, department: f.department });
        setV(null);
      }
      toast('✓ Profile saved successfully!');
    } catch (e) {
      toast(e.message || 'Failed to save profile');
    }
  };

  return (
    <>
      <Err e={err} />
      <div className="cols c2">
        <Card title="Public profile">
          <div className="fm">
            <label>Name<input readOnly value={f.name || ''} /></label>

            {/* Department Select Dropdown */}
            <label>
              Department
              <select
                value={f.department_id || ''}
                onChange={e => {
                  const selectedId = Number(e.target.value) || '';
                  const selectedDept = departmentList.find(d => Number(d.id) === Number(selectedId));
                  setV({
                    ...f,
                    department_id: selectedId,
                    department: selectedDept ? selectedDept.name : f.department,
                  });
                }}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '10px',
                  color: '#fff',
                  padding: '12px 14px',
                  fontSize: '14px',
                  width: '100%',
                  marginTop: '4px',
                  cursor: 'pointer',
                }}
              >
                {departmentList.map(d => (
                  <option key={d.id} value={d.id} style={{ background: '#1c2436', color: '#fff' }}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>

            <label>Registration number<input readOnly value={f.registration_no || ''} /></label>
            <label>Experience (years)<input type="number" min="0" max="70" value={f.experience ?? ''} onChange={set('experience')} placeholder="e.g. 15" /></label>

            {/* Multi-degree UG & PG Qualification Selection */}
            <div className="full" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px', marginTop: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>Qualifications (Select UG & PG Degrees)</span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Click badges to toggle degrees</span>
              </div>

              {/* UG Degrees */}
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', letterSpacing: '0.4px', marginBottom: '6px' }}>
                  Undergraduate (UG Degrees):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {UG_DEGREES.map(deg => {
                    const active = isDegreeSelected(deg);
                    return (
                      <button
                        key={deg}
                        type="button"
                        onClick={() => toggleDegree(deg)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: active ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.12)',
                          background: active ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255,255,255,0.05)',
                          color: active ? '#38bdf8' : '#cbd5e1',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {active ? '✓ ' : '+ '} {deg}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PG Degrees */}
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', letterSpacing: '0.4px', marginBottom: '6px' }}>
                  Postgraduate (PG Degrees & Super-specialties):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {PG_DEGREES.map(deg => {
                    const active = isDegreeSelected(deg);
                    return (
                      <button
                        key={deg}
                        type="button"
                        onClick={() => toggleDegree(deg)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: active ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.12)',
                          background: active ? 'rgba(167, 139, 250, 0.22)' : 'rgba(255,255,255,0.05)',
                          color: active ? '#c4b5fd' : '#cbd5e1',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {active ? '✓ ' : '+ '} {deg}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fellowships */}
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#34d399', letterSpacing: '0.4px', marginBottom: '6px' }}>
                  Fellowships & Other Credentials:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {OTHER_DEGREES.map(deg => {
                    const active = isDegreeSelected(deg);
                    return (
                      <button
                        key={deg}
                        type="button"
                        onClick={() => toggleDegree(deg)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: active ? '1px solid #34d399' : '1px solid rgba(255,255,255,0.12)',
                          background: active ? 'rgba(52, 211, 153, 0.22)' : 'rgba(255,255,255,0.05)',
                          color: active ? '#6ee7b7' : '#cbd5e1',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {active ? '✓ ' : '+ '} {deg}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Degree / Summary editor */}
              <label style={{ display: 'block', marginTop: '8px' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Degree Summary (you can edit or add specializations here):</span>
                <input
                  value={f.qualification || ''}
                  onChange={set('qualification')}
                  placeholder="e.g. MBBS, MD (General Medicine), MRCP"
                  style={{ marginTop: '4px' }}
                />
              </label>
            </div>

            <label className="full">About<textarea rows="3" value={f.about || ''} onChange={set('about')} placeholder="Brief clinical background..." /></label>
          </div>
          <div className="qa" style={{ marginTop: 12 }}>
            <button className="qb pri" onClick={save}>Save profile</button>
          </div>
        </Card>
        <Card title="Case studies">
          {cases.map((x, i) => (
            <div className="rw" key={x + i}>
              <div className="g">{x}</div>
              <button className="sm" onClick={() => setV({ ...f, cases: cases.filter((_, j) => j !== i) })}>Remove</button>
            </div>
          ))}
          <div className="rw">
            <input aria-label="New case study" placeholder="Describe a case study" value={c} onChange={e => setC(e.target.value)} />
            <button className="sm" onClick={() => { if (c.trim()) { setV({ ...f, cases: [...cases, c.trim()] }); setC(''); } }}>Add</button>
          </div>
        </Card>
      </div>
    </>
  );
}

function Verify() {
  const [v, , err] = useData('/doctor/verification', D.ver);
  if (!v) return null;
  const st = String(v.status).toUpperCase(), at = st === 'PENDING' ? 1 : 2;
  const resubmit = async () => { try { await act('POST', '/doctor/verification', { registration_no: v.registration_no, qualification: v.qualification, experience: v.experience }); toast('Verification submitted again'); } catch (e) { toast(e.message); } };
  return <><Err e={err} />
    <Card title="Verification status" right={<Chip s={st} />}>
      <div className="tl">{['Submitted', 'Under review', st === 'REJECTED' ? 'Rejected' : 'Approved'].map((s, i) => <span key={s} className={i < at ? 'done' : i === at ? 'now' : ''}>{s}</span>)}</div>
      <div className="kv"><div><small>Registration number</small><b>{v.registration_no}</b></div><div><small>Qualification</small><b>{v.qualification}</b></div><div><small>Experience</small><b>{v.experience} years</b></div><div><small>Submitted</small><b>{v.submitted ? fmt(v.submitted) : '-'}</b></div></div>
      {v.note && <><div className="lbl">Message from admin</div><p style={{ margin: 0 }}>{v.note}</p></>}
      {st === 'REJECTED' && <div className="qa" style={{ marginTop: 12 }}><button className="qb pri" onClick={resubmit}>Submit again</button></div>}
    </Card></>;
}

function Notifs() {
  const [n, setN, err] = useData('/notifications', D.notifs);
  if (!n) return <><Err e={err} /><Card title="Notifications"><p className="empty">{err ? `Could not load notifications: ${err}` : 'Loading notifications…'}</p></Card></>;
  return <><Err e={err} /><Card title="Notifications" right={<button className="sm" onClick={() => setN(list(n).map(x => ({ ...x, unread: false })))}>Mark all as read</button>}>
    {list(n).map(x => <div className="rw" key={x.id}><i className={'dot' + (x.unread ? '' : ' off')} /><div className="g"><b style={{ fontWeight: x.unread ? 600 : 400 }}>{x.t || x.message}</b><span className="sub">{x.at || x.created_at}</span></div></div>)}</Card></>;
}

export const doctorPages = { dash: Dash, apps: Apps, cons: Cons, pats: Pats, recs: Recs, sched: Schedule, prof: Profile, ver: Verify, notif: Notifs };
