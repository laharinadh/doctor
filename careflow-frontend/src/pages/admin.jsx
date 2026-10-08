import { useState, useMemo } from 'react';
import { Card, Stat, Chip, Line, Table, toast, inr } from '../ui';
import { useData, act } from '../api';

const M = {
  dash: {
    stats: { doctors: 34, patients: 1284, pending: 3, today: 154, fees: 128400 },
    series: Array.from({ length: 30 }, (_, i) => Math.round(30 + i * 2.4 + Math.sin(i / 2) * 9)),
    top: [{ n: 'Dr. Ananya Rao', c: 42 }, { n: 'Dr. Meera Iyer', c: 37 }, { n: 'Dr. Kiran Reddy', c: 31 }, { n: 'Dr. Vikram Shah', c: 24 }, { n: 'Dr. Sahana Nair', c: 19 }],
    recent: [{ n: 'Rahul Menon with Dr. Rao', sub: 'Video · 10:00', st: 'CONFIRMED' }, { n: 'Sneha Kapoor with Dr. Shah', sub: 'Audio · 10:30', st: 'CONFIRMED' }, { n: 'Divya Rao with Dr. Iyer', sub: 'In person · 09:00', st: 'COMPLETED' }, { n: 'Imran Sheikh with Dr. Reddy', sub: 'Video · 11:30', st: 'PENDING' }],
    pays: [{ ref: 'pay_Qx81aK', amt: 99, st: 'SUCCESS' }, { ref: 'pay_Qx82bL', amt: 99, st: 'SUCCESS' }, { ref: 'pay_Qx83cM', amt: 99, st: 'PENDING' }, { ref: 'pay_Qx84dN', amt: 99, st: 'FAILED' }],
  },
  docs: [
    { id: 1, name: 'Dr. Ananya Rao', department: 'Cardiology', department_name: 'Cardiology', phone: '+91 98401 22331', email: 'ananya.rao@example.com', registration_no: 'MCI-40137', qualification: 'MBBS, MD Cardiology', experience_years: 12, consultation_fee: 800, status: 'APPROVED', verification_status: 'APPROVED' },
    { id: 2, name: 'Dr. Vikram Shah', department: 'Dermatology', department_name: 'Dermatology', phone: '+91 98401 22332', email: 'vikram.shah@example.com', registration_no: 'MCI-40274', qualification: 'MD Dermatology', experience_years: 9, consultation_fee: 700, status: 'APPROVED', verification_status: 'APPROVED' },
    { id: 11, name: 'Dr. Rohit Verma', department: 'Orthopedics', department_name: 'Orthopedics', phone: '+91 98401 22333', email: 'rohit.v@example.com', registration_no: 'MCI-48213', qualification: 'MS Ortho', experience_years: 7, consultation_fee: 650, status: 'PENDING', verification_status: 'PENDING' },
    { id: 12, name: 'Dr. Lakshmi Pillai', department: 'Dermatology', department_name: 'Dermatology', phone: '+91 98401 22334', email: 'lakshmi.p@example.com', registration_no: 'APMC-77102', qualification: 'MBBS, DVD', experience_years: 11, consultation_fee: 600, status: 'PENDING', verification_status: 'PENDING' },
    { id: 13, name: 'Dr. Arjun Das', department: 'General Medicine', department_name: 'General Medicine', phone: '+91 98401 22335', email: 'arjun.d@example.com', registration_no: 'TSMC-30987', qualification: 'MBBS, MD Gen Med', experience_years: 5, consultation_fee: 500, status: 'PENDING', verification_status: 'PENDING' },
    { id: 14, name: 'Dr. Neha Joshi', department: 'Neurology', department_name: 'Neurology', phone: '+91 98401 22336', email: 'neha.j@example.com', registration_no: 'MCI-51120', qualification: 'DM Neurology', experience_years: 14, consultation_fee: 1000, status: 'REJECTED', verification_status: 'REJECTED' },
    { id: 15, name: 'Dr. Farhan Ali', department: 'Cardiology', department_name: 'Cardiology', phone: '+91 98401 22337', email: 'farhan.a@example.com', registration_no: 'MCI-39001', qualification: 'MD, DM Cardio', experience_years: 15, consultation_fee: 900, status: 'SUSPENDED', verification_status: 'SUSPENDED' },
  ],
  pats: [
    { id: 1, name: 'Rahul Menon', phone: '+91 98400 45210', email: 'rahul.menon@example.com', height_cm: 178, weight_kg: 72, status: 'ACTIVE' },
    { id: 2, name: 'Sneha Kapoor', phone: '+91 90100 11870', email: 'sneha.k@example.com', height_cm: 162, weight_kg: 55, status: 'ACTIVE' },
    { id: 3, name: 'Divya Rao', phone: '+91 97200 66100', email: 'divya.rao@example.com', height_cm: 165, weight_kg: 60, status: 'ACTIVE' },
    { id: 4, name: 'Karthik Naidu', phone: '+91 96500 33211', email: 'karthik.n@example.com', height_cm: 180, weight_kg: 84, status: 'SUSPENDED' },
  ],
  depts: [
    { id: 1, name: 'General Medicine', description: 'Primary care & internal medicine', status: 'ACTIVE' },
    { id: 2, name: 'Cardiology', description: 'Heart and cardiovascular system', status: 'ACTIVE' },
    { id: 3, name: 'Dermatology', description: 'Skin, hair and cosmetic treatments', status: 'ACTIVE' },
    { id: 4, name: 'Pediatrics', description: 'Care for infants and children', status: 'ACTIVE' },
    { id: 5, name: 'Orthopedics', description: 'Bone and joint health', status: 'ACTIVE' },
    { id: 6, name: 'Neurology', description: 'Brain and nervous system', status: 'ACTIVE' },
  ],
  apps: [
    { id: 1, appointment_number: 'APT-20261008-A1B2', patient_id: 1, doctor_id: 1, patient: 'Rahul Menon', doctor: 'Dr. Ananya Rao', when: 'Today 10:00', appointment_date: '2026-10-08', start_time: '10:00:00', mode: 'VIDEO', consultation_mode: 'VIDEO', status: 'CONFIRMED', platform_fee: 99, meeting_url: 'https://meet.google.com/med-dr-rao' },
    { id: 2, appointment_number: 'APT-20261008-C3D4', patient_id: 2, doctor_id: 2, patient: 'Sneha Kapoor', doctor: 'Dr. Vikram Shah', when: 'Today 10:30', appointment_date: '2026-10-08', start_time: '10:30:00', mode: 'AUDIO', consultation_mode: 'AUDIO', status: 'CONFIRMED', platform_fee: 99, meeting_url: null },
    { id: 3, appointment_number: 'APT-20261007-E5F6', patient_id: 3, doctor_id: 1, patient: 'Divya Rao', doctor: 'Dr. Ananya Rao', when: 'Yesterday 09:00', appointment_date: '2026-10-07', start_time: '09:00:00', mode: 'FACE_TO_FACE', consultation_mode: 'FACE_TO_FACE', status: 'COMPLETED', platform_fee: 99, meeting_url: null },
    { id: 4, appointment_number: 'APT-20261006-G7H8', patient_id: 4, doctor_id: 2, patient: 'Karthik Naidu', doctor: 'Dr. Vikram Shah', when: 'Mon 12:00', appointment_date: '2026-10-06', start_time: '12:00:00', mode: 'VIDEO', consultation_mode: 'VIDEO', status: 'CANCELLED', platform_fee: 99, meeting_url: null, cancellation_reason: 'Patient requested reschedule' },
  ],
  pay: [
    { id: 1, ref: 'pay_Qx81aK', appointment_number: 'APT-20261008-A1B2', patient: 'Rahul Menon', amount: 99, status: 'SUCCESS' },
    { id: 2, ref: 'pay_Qx82bL', appointment_number: 'APT-20261008-C3D4', patient: 'Sneha Kapoor', amount: 99, status: 'SUCCESS' },
    { id: 3, ref: 'pay_Qx83cM', appointment_number: 'APT-20261007-E5F6', patient: 'Imran Sheikh', amount: 99, status: 'PENDING' },
    { id: 4, ref: 'pay_Qx84dN', appointment_number: 'APT-20261006-G7H8', patient: 'Karthik Naidu', amount: 99, status: 'FAILED' },
  ],
  log: [
    { id: 1, at: 'Just now', actor: 'Admin', action: 'ADMIN_DOCTOR_UPDATED', target: 'Dr. Ananya Rao' },
    { id: 2, at: '4 min ago', actor: 'Admin', action: 'ADMIN_BULK_DOCTORS_CREATED', target: '10 Doctors' },
    { id: 3, at: '7 min ago', actor: 'Admin', action: 'ADMIN_PATIENT_UPDATED', target: 'Rahul Menon' },
    { id: 4, at: '12 min ago', actor: 'Admin', action: 'ADMIN_APPOINTMENT_MODIFIED', target: 'APT-20261008-A1B2' },
    { id: 5, at: '20 min ago', actor: 'Admin', action: 'DOCTOR_VERIFIED', target: 'Dr. Vikram Shah' },
  ],
};

const SAMPLE_BULK_DOCTORS = [
  { name: 'Dr. Alok Verma', phone: '+91 98111 22331', email: 'alok.verma@example.com', department_id: 1, qualification: 'MBBS, MD', experience_years: 12, consultation_fee: 700, registration_number: 'MCI-88121', bio: 'Experienced general medicine consultant.', verification_status: 'APPROVED', status: 'ACTIVE' },
  { name: 'Dr. Priya Sundaram', phone: '+91 98111 22332', email: 'priya.s@example.com', department_id: 3, qualification: 'MD Dermatology', experience_years: 9, consultation_fee: 650, registration_number: 'MCI-88122', bio: 'Specialist in clinical and cosmetic dermatology.', verification_status: 'APPROVED', status: 'ACTIVE' },
  { name: 'Dr. Harish Nambiar', phone: '+91 98111 22333', email: 'harish.n@example.com', department_id: 4, qualification: 'MBBS, DCH, MD', experience_years: 14, consultation_fee: 600, registration_number: 'MCI-88123', bio: 'Senior pediatric care expert.', verification_status: 'APPROVED', status: 'ACTIVE' },
  { name: 'Dr. Sunita Banerjee', phone: '+91 98111 22334', email: 'sunita.b@example.com', department_id: 2, qualification: 'MBBS, DM Cardiology', experience_years: 11, consultation_fee: 850, registration_number: 'MCI-88124', bio: 'Interventional cardiologist.', verification_status: 'APPROVED', status: 'ACTIVE' },
  { name: 'Dr. Tariq Mansoor', phone: '+91 98111 22335', email: 'tariq.m@example.com', department_id: 6, qualification: 'DM Neurology', experience_years: 16, consultation_fee: 1000, registration_number: 'MCI-88125', bio: 'Neurologist with extensive acute care tenure.', verification_status: 'APPROVED', status: 'ACTIVE' },
  { name: 'Dr. Deepa Krishnan', phone: '+91 98111 22336', email: 'deepa.k@example.com', department_id: 5, qualification: 'MS Ortho', experience_years: 8, consultation_fee: 750, registration_number: 'MCI-88126', bio: 'Joint replacement and trauma surgery.', verification_status: 'APPROVED', status: 'ACTIVE' },
  { name: 'Dr. Saurabh Roy', phone: '+91 98111 22337', email: 'saurabh.r@example.com', department_id: 1, qualification: 'MD Gen Med', experience_years: 10, consultation_fee: 500, registration_number: 'MCI-88127', bio: 'Focus on lifestyle and metabolic disease management.', verification_status: 'APPROVED', status: 'ACTIVE' },
  { name: 'Dr. Kavita Joshi', phone: '+91 98111 22338', email: 'kavita.j@example.com', department_id: 3, qualification: 'MS ENT', experience_years: 7, consultation_fee: 600, registration_number: 'MCI-88128', bio: 'Head and neck clinical specialist.', verification_status: 'APPROVED', status: 'ACTIVE' },
  { name: 'Dr. Manav Mehta', phone: '+91 98111 22339', email: 'manav.m@example.com', department_id: 2, qualification: 'DM Cardiology', experience_years: 15, consultation_fee: 900, registration_number: 'MCI-88129', bio: 'Preventive cardiology consultant.', verification_status: 'APPROVED', status: 'ACTIVE' },
  { name: 'Dr. Ritu Sen', phone: '+91 98111 22340', email: 'ritu.s@example.com', department_id: 4, qualification: 'MD Pediatrics', experience_years: 6, consultation_fee: 550, registration_number: 'MCI-88130', bio: 'Neonatal and child development specialist.', verification_status: 'APPROVED', status: 'ACTIVE' },
];

const SAMPLE_BULK_PATIENTS = [
  { name: 'Aarav Malhotra', phone: '+91 99201 11001', email: 'aarav.m@example.com', height_cm: 178, weight_kg: 74, status: 'ACTIVE' },
  { name: 'Ishita Gupta', phone: '+91 99201 11002', email: 'ishita.g@example.com', height_cm: 162, weight_kg: 56, status: 'ACTIVE' },
  { name: 'Rohan Deshmukh', phone: '+91 99201 11003', email: 'rohan.d@example.com', height_cm: 182, weight_kg: 80, status: 'ACTIVE' },
  { name: 'Ananya Singhania', phone: '+91 99201 11004', email: 'ananya.s@example.com', height_cm: 158, weight_kg: 52, status: 'ACTIVE' },
  { name: 'Devendra Patil', phone: '+91 99201 11005', email: 'devendra.p@example.com', height_cm: 172, weight_kg: 68, status: 'ACTIVE' },
  { name: 'Meenakshi Iyer', phone: '+91 99201 11006', email: 'meenakshi.i@example.com', height_cm: 165, weight_kg: 61, status: 'ACTIVE' },
  { name: 'Vikramjit Sahni', phone: '+91 99201 11007', email: 'vikramjit.s@example.com', height_cm: 180, weight_kg: 85, status: 'ACTIVE' },
  { name: 'Pooja Hegde', phone: '+91 99201 11008', email: 'pooja.h@example.com', height_cm: 160, weight_kg: 54, status: 'ACTIVE' },
  { name: 'Kunal Kapoor', phone: '+91 99201 11009', email: 'kunal.k@example.com', height_cm: 175, weight_kg: 72, status: 'ACTIVE' },
  { name: 'Tanvi Shinde', phone: '+91 99201 11010', email: 'tanvi.s@example.com', height_cm: 167, weight_kg: 59, status: 'ACTIVE' },
];

function Modal({ title, wide, onClose, children }) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal-box ${wide ? 'wide' : ''}`}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">×</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// DASHBOARD
// ──────────────────────────────────────────
function Dash({ go }) {
  const [data, , err] = useData('/admin/dashboard', M.dash);
  if (!data) return null;
  const d = { ...M.dash, ...data }, s = { ...M.dash.stats, ...(d.stats || {}) };
  const pending = M.docs.filter(x => x.status === 'PENDING' || x.verification_status === 'PENDING');
  return <>
    {err && <p className="note">Showing sample data. {err}</p>}
    <div className="stats">
      <Stat ic="Dr" v={s.doctors} l="Active doctors" s={`${s.pending || 0} awaiting review`} />
      <Stat ic="Pt" v={s.patients.toLocaleString?.('en-IN') ?? s.patients} l="Registered patients" s="Across all departments" />
      <Stat ic="!" v={s.pending || 0} l="Pending verifications" s="Needs an admin decision" />
      <Stat ic="Ap" v={s.today || 0} l="Appointments today" s="All consultation modes" />
      <Stat ic="₹" v={inr(s.fees || 0)} l="Platform fees collected" s="Razorpay settled" />
    </div>
    <div className="qa">
      <button className="qb pri" onClick={() => go('docs')}>Manage Doctors</button>
      <button className="qb pri" onClick={() => go('pats')}>Manage Patients</button>
      <button className="qb dk" onClick={() => go('apps')}>Schedule & Appointments</button>
      <button className="qb dk" onClick={() => go('depts')}>Departments</button>
      <button className="qb" onClick={() => go('set')}>Platform Fee</button>
      <button className="qb" onClick={() => go('log')}>Audit Logs</button>
    </div>
    <div className="cols c21">
      <Card title="Bookings, last 30 days"><Line data={d.series} /></Card>
      <Card title="Top doctors"><ol className="top-l">{d.top.map((t, i) => <li key={t.n}><span>{i + 1}. {t.n}</span><b>{t.c}</b></li>)}</ol></Card>
    </div>
    <div className="cols c3">
      <Card title="Recent appointments">{d.recent.map(r => <div className="rw" key={r.n}><div className="g"><b>{r.n}</b><span className="sub">{r.sub}</span></div><Chip s={r.st} /></div>)}</Card>
      <Card title="Payments"><Table cols={[{ h: 'Reference', k: 'ref' }, { h: 'Amount', r: r => inr(r.amt || r.amount) }, { h: 'Status', r: r => <Chip s={r.st || r.status} /> }]} rows={d.pays} /></Card>
      <Card title="Verification requests">{pending.map(p => <div className="rw" key={p.id}><div className="g"><b>{p.name}</b><span className="sub">{p.department_name || p.department} · {p.registration_no || p.registration_number}</span></div><button className="sm" onClick={() => go('docs')}>Review</button></div>)}</Card>
    </div>
  </>;
}

// ──────────────────────────────────────────
// DOCTORS MANAGEMENT (Single Add, Bulk Add, Edit Profile, Delete, Verify)
// ──────────────────────────────────────────
function Docs() {
  const [docs, setDocs, err] = useData('/admin/doctors', M.docs);
  const [f, setF] = useState('ALL');
  const [q, setQ] = useState('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);

  // Single Add form
  const [newDoc, setNewDoc] = useState({
    name: '', phone: '', email: '', department_id: 1, qualification: '',
    experience_years: 5, consultation_fee: 500, registration_number: '', bio: '',
    verification_status: 'APPROVED', status: 'ACTIVE'
  });

  // Bulk Add text
  const [bulkText, setBulkText] = useState('');

  if (!docs) return null;
  const list = Array.isArray(docs) ? docs : docs.items || [];

  const filtered = list.filter(d => {
    const st = (d.status || d.verification_status || '').toUpperCase();
    const matchesFilter = f === 'ALL' || st === f;
    const term = q.toLowerCase().trim();
    const matchesQuery = !term ||
      (d.name && d.name.toLowerCase().includes(term)) ||
      (d.phone && d.phone.toLowerCase().includes(term)) ||
      ((d.department_name || d.department) && (d.department_name || d.department).toLowerCase().includes(term)) ||
      ((d.registration_no || d.registration_number) && (d.registration_no || d.registration_number).toLowerCase().includes(term));
    return matchesFilter && matchesQuery;
  });

  const updateDoctorStatus = async (d, verb, status) => {
    try {
      await act('PATCH', `/admin/doctors/${d.id}/${verb}`);
      setDocs(x => (Array.isArray(x) ? x : x.items).map(y => y.id === d.id ? { ...y, status, verification_status: status } : y));
      toast(`${d.name} is now ${status.toLowerCase()}`);
    } catch (e) { toast(e.message); }
  };

  const handleSaveEdit = async () => {
    if (!editingDoc) return;
    try {
      const payload = {
        name: editingDoc.name,
        phone: editingDoc.phone,
        email: editingDoc.email,
        department_id: Number(editingDoc.department_id) || undefined,
        qualification: editingDoc.qualification,
        experience_years: Number(editingDoc.experience_years) || 0,
        consultation_fee: Number(editingDoc.consultation_fee) || 0,
        registration_number: editingDoc.registration_number || editingDoc.registration_no,
        bio: editingDoc.bio,
        verification_status: editingDoc.verification_status || editingDoc.status,
        status: editingDoc.status || 'ACTIVE'
      };
      await act('PATCH', `/admin/doctors/${editingDoc.id}`, payload);
      setDocs(x => (Array.isArray(x) ? x : x.items).map(y => y.id === editingDoc.id ? { ...y, ...payload } : y));
      toast(`Updated profile for ${editingDoc.name}`);
      setEditingDoc(null);
    } catch (e) { toast(e.message); }
  };

  const handleDeleteDoctor = async (d) => {
    if (!window.confirm(`Are you sure you want to delete ${d.name}? This will remove schedules and history.`)) return;
    try {
      await act('DELETE', `/admin/doctors/${d.id}`);
      setDocs(x => (Array.isArray(x) ? x : x.items).filter(y => y.id !== d.id));
      toast(`Deleted doctor ${d.name}`);
    } catch (e) { toast(e.message); }
  };

  const handleCreateSingle = async (e) => {
    e.preventDefault();
    if (!newDoc.name || !newDoc.phone) return toast('Name and phone are required');
    try {
      const payload = {
        ...newDoc,
        experience_years: Number(newDoc.experience_years) || 0,
        consultation_fee: Number(newDoc.consultation_fee) || 0,
        department_id: Number(newDoc.department_id) || null
      };
      const created = await act('POST', '/admin/doctors', payload);
      const toAdd = created || { id: Date.now(), ...payload };
      setDocs(x => [toAdd, ...(Array.isArray(x) ? x : x.items)]);
      toast(`Created doctor ${newDoc.name}`);
      setShowAddModal(false);
      setNewDoc({ name: '', phone: '', email: '', department_id: 1, qualification: '', experience_years: 5, consultation_fee: 500, registration_number: '', bio: '', verification_status: 'APPROVED', status: 'ACTIVE' });
    } catch (err) { toast(err.message); }
  };

  const handleBulkImport = async () => {
    let parsed = [];
    try {
      parsed = JSON.parse(bulkText);
      if (!Array.isArray(parsed)) parsed = parsed.doctors || [];
    } catch {
      // Try CSV/newline fallback
      const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
      parsed = lines.map((line, idx) => {
        const parts = line.split(',').map(p => p.trim());
        return {
          name: parts[0] || `Dr. Imported ${idx + 1}`,
          phone: parts[1] || `+9198000${String(idx).padStart(5, '0')}`,
          email: parts[2] || `doctor${idx + 1}@clinic.com`,
          department_id: Number(parts[3]) || 1,
          qualification: parts[4] || 'MBBS',
          experience_years: Number(parts[5]) || 5,
          consultation_fee: Number(parts[6]) || 500,
          verification_status: 'APPROVED',
          status: 'ACTIVE'
        };
      });
    }

    if (!parsed.length) return toast('No valid doctor entries found to import');

    try {
      const res = await act('POST', '/admin/doctors/bulk', { doctors: parsed });
      const addedCount = res?.createdCount ?? parsed.length;
      setDocs(x => [...parsed.map((p, i) => ({ id: Date.now() + i, ...p })), ...(Array.isArray(x) ? x : x.items)]);
      toast(`Successfully imported ${addedCount} doctors!`);
      setShowBulkModal(false);
      setBulkText('');
    } catch (err) { toast(err.message); }
  };

  return <>
    {err && <p className="note">Showing sample data. {err}</p>}
    <div className="admin-header-row">
      <div className="pills" style={{ margin: 0 }}>
        {['ALL', 'APPROVED', 'PENDING', 'REJECTED', 'SUSPENDED'].map(x => (
          <button key={x} aria-pressed={f === x} onClick={() => setF(x)}>{x[0] + x.slice(1).toLowerCase()}</button>
        ))}
      </div>
      <div className="qa" style={{ margin: 0 }}>
        <input
          className="admin-search-input"
          placeholder="Search by name, phone, dept, reg..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <button className="qb pri" onClick={() => setShowAddModal(true)}>+ Add Doctor</button>
        <button className="qb dk" onClick={() => setShowBulkModal(true)}>⚡ Bulk Add Doctors</button>
      </div>
    </div>

    <Card>
      <Table rows={filtered} cols={[
        { h: 'Doctor Profile', r: d => <div><b>{d.name}</b><span className="sub">{d.department_name || d.department || 'General'} · {d.qualification || 'MBBS'} ({d.experience_years || 0} yrs exp)</span></div> },
        { h: 'Contact & License', r: d => <div><span>{d.phone}</span><span className="sub">{d.email || 'No email'} · Reg: {d.registration_number || d.registration_no || 'N/A'}</span></div> },
        { h: 'Consultation Fee', r: d => <b>{inr(d.consultation_fee || d.fee || 500)}</b> },
        { h: 'Status', r: d => <Chip s={d.verification_status || d.status} /> },
        { h: 'Actions', r: d => <div className="qa" style={{ margin: 0 }}>
          <button className="sm" onClick={() => setEditingDoc({ ...d })}>Edit</button>
          {d.status !== 'APPROVED' && <button className="sm" onClick={() => updateDoctorStatus(d, 'verify', 'APPROVED')}>Approve</button>}
          {d.status === 'PENDING' && <button className="sm" onClick={() => updateDoctorStatus(d, 'reject', 'REJECTED')}>Reject</button>}
          {d.status === 'APPROVED' ? <button className="sm" onClick={() => updateDoctorStatus(d, 'suspend', 'SUSPENDED')}>Suspend</button> : <button className="sm" onClick={() => updateDoctorStatus(d, 'verify', 'APPROVED')}>Activate</button>}
          <button className="sm" style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }} onClick={() => handleDeleteDoctor(d)}>Delete</button>
        </div> },
      ]} />
    </Card>

    {/* Single Add Doctor Modal */}
    {showAddModal && (
      <Modal title="Add New Doctor (Single Profile)" onClose={() => setShowAddModal(false)}>
        <form onSubmit={handleCreateSingle}>
          <div className="fm">
            <label>Full Name *<input required value={newDoc.name} onChange={e => setNewDoc({ ...newDoc, name: e.target.value })} placeholder="Dr. Rajesh Patel" /></label>
            <label>Phone Number *<input required value={newDoc.phone} onChange={e => setNewDoc({ ...newDoc, phone: e.target.value })} placeholder="+91 98765 43210" /></label>
            <label>Email Address<input type="email" value={newDoc.email} onChange={e => setNewDoc({ ...newDoc, email: e.target.value })} placeholder="dr.patel@hospital.com" /></label>
            <label>Department
              <select value={newDoc.department_id} onChange={e => setNewDoc({ ...newDoc, department_id: Number(e.target.value) })}>
                <option value={1}>General Medicine</option>
                <option value={2}>Cardiology</option>
                <option value={3}>Dermatology</option>
                <option value={4}>Pediatrics</option>
                <option value={5}>Orthopedics</option>
                <option value={6}>Neurology</option>
              </select>
            </label>
            <label>Medical Registration Number<input value={newDoc.registration_number} onChange={e => setNewDoc({ ...newDoc, registration_number: e.target.value })} placeholder="MCI-48192" /></label>
            <label>Qualification<input value={newDoc.qualification} onChange={e => setNewDoc({ ...newDoc, qualification: e.target.value })} placeholder="MBBS, MD Cardiology" /></label>
            <label>Experience (Years)<input type="number" min="0" max="60" value={newDoc.experience_years} onChange={e => setNewDoc({ ...newDoc, experience_years: e.target.value })} /></label>
            <label>Consultation Fee (₹)<input type="number" min="0" step="50" value={newDoc.consultation_fee} onChange={e => setNewDoc({ ...newDoc, consultation_fee: e.target.value })} /></label>
            <label>Verification Status
              <select value={newDoc.verification_status} onChange={e => setNewDoc({ ...newDoc, verification_status: e.target.value })}>
                <option value="APPROVED">APPROVED (Verified immediately)</option>
                <option value="PENDING">PENDING (Review required)</option>
              </select>
            </label>
            <label>Account Status
              <select value={newDoc.status} onChange={e => setNewDoc({ ...newDoc, status: e.target.value })}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            </label>
            <label className="full">Bio / Profile Notes<textarea rows={3} value={newDoc.bio} onChange={e => setNewDoc({ ...newDoc, bio: e.target.value })} placeholder="Summary of specialties, hospital affiliations and clinical focus..." /></label>
          </div>
          <div className="modal-footer" style={{ marginTop: 16 }}>
            <button type="button" className="qb" onClick={() => setShowAddModal(false)}>Cancel</button>
            <button type="submit" className="qb pri">Create Doctor</button>
          </div>
        </form>
      </Modal>
    )}

    {/* Bulk Add Doctors Modal */}
    {showBulkModal && (
      <Modal title="Bulk Import Doctors (Large List)" wide onClose={() => setShowBulkModal(false)}>
        <div>
          <div className="admin-sample-bar">
            <span>Paste JSON array or comma-separated rows (Name, Phone, Email, DeptId, Qual, Exp, Fee)</span>
            <div className="qa" style={{ margin: 0 }}>
              <button type="button" className="sm" onClick={() => setBulkText(JSON.stringify(SAMPLE_BULK_DOCTORS, null, 2))}>Load 10 Sample Doctors</button>
              <button type="button" className="sm" onClick={() => setBulkText('')}>Clear</button>
            </div>
          </div>
          <textarea
            className="admin-bulk-area"
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            placeholder="[&#10;  { &quot;name&quot;: &quot;Dr. Alok Verma&quot;, &quot;phone&quot;: &quot;+91 98111 22331&quot;, &quot;qualification&quot;: &quot;MBBS, MD&quot;, &quot;consultation_fee&quot;: 700 }&#10;]&#10;or:&#10;Dr. Name, +919876500001, email@clinic.com, 1, MBBS, 10, 500"
          />
          <div className="modal-footer" style={{ marginTop: 16 }}>
            <button type="button" className="qb" onClick={() => setShowBulkModal(false)}>Cancel</button>
            <button type="button" className="qb pri" disabled={!bulkText.trim()} onClick={handleBulkImport}>Import Doctors Now</button>
          </div>
        </div>
      </Modal>
    )}

    {/* Edit Doctor Profile Modal */}
    {editingDoc && (
      <Modal title={`Edit Profile — ${editingDoc.name}`} onClose={() => setEditingDoc(null)}>
        <div className="fm">
          <label>Full Name *<input value={editingDoc.name} onChange={e => setEditingDoc({ ...editingDoc, name: e.target.value })} /></label>
          <label>Phone Number *<input value={editingDoc.phone} onChange={e => setEditingDoc({ ...editingDoc, phone: e.target.value })} /></label>
          <label>Email Address<input type="email" value={editingDoc.email || ''} onChange={e => setEditingDoc({ ...editingDoc, email: e.target.value })} /></label>
          <label>Department
            <select value={editingDoc.department_id || 1} onChange={e => setEditingDoc({ ...editingDoc, department_id: Number(e.target.value) })}>
              <option value={1}>General Medicine</option>
              <option value={2}>Cardiology</option>
              <option value={3}>Dermatology</option>
              <option value={4}>Pediatrics</option>
              <option value={5}>Orthopedics</option>
              <option value={6}>Neurology</option>
            </select>
          </label>
          <label>Registration Number<input value={editingDoc.registration_number || editingDoc.registration_no || ''} onChange={e => setEditingDoc({ ...editingDoc, registration_number: e.target.value, registration_no: e.target.value })} /></label>
          <label>Qualification<input value={editingDoc.qualification || ''} onChange={e => setEditingDoc({ ...editingDoc, qualification: e.target.value })} /></label>
          <label>Experience (Years)<input type="number" min="0" value={editingDoc.experience_years || 0} onChange={e => setEditingDoc({ ...editingDoc, experience_years: e.target.value })} /></label>
          <label>Consultation Fee (₹)<input type="number" min="0" value={editingDoc.consultation_fee || 0} onChange={e => setEditingDoc({ ...editingDoc, consultation_fee: e.target.value })} /></label>
          <label>Verification Status
            <select value={editingDoc.verification_status || editingDoc.status} onChange={e => setEditingDoc({ ...editingDoc, verification_status: e.target.value, status: e.target.value })}>
              <option value="APPROVED">APPROVED</option>
              <option value="PENDING">PENDING</option>
              <option value="UNDER_REVIEW">UNDER_REVIEW</option>
              <option value="REJECTED">REJECTED</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          </label>
          <label>Account Status
            <select value={editingDoc.status || 'ACTIVE'} onChange={e => setEditingDoc({ ...editingDoc, status: e.target.value })}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          </label>
          <label className="full">Bio / Profile Description<textarea rows={3} value={editingDoc.bio || ''} onChange={e => setEditingDoc({ ...editingDoc, bio: e.target.value })} /></label>
        </div>
        <div className="modal-footer" style={{ marginTop: 16 }}>
          <button type="button" className="qb" onClick={() => setEditingDoc(null)}>Cancel</button>
          <button type="button" className="qb pri" onClick={handleSaveEdit}>Save Changes</button>
        </div>
      </Modal>
    )}
  </>;
}

// ──────────────────────────────────────────
// PATIENTS MANAGEMENT (Single Add, Bulk Add, Edit Profile, Delete)
// ──────────────────────────────────────────
function Pats() {
  const [pats, setPats, err] = useData('/admin/patients', M.pats);
  const [f, setF] = useState('ALL');
  const [q, setQ] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingPat, setEditingPat] = useState(null);

  const [newPat, setNewPat] = useState({ name: '', phone: '', email: '', height_cm: 170, weight_kg: 68, status: 'ACTIVE' });
  const [bulkText, setBulkText] = useState('');

  if (!pats) return null;
  const list = Array.isArray(pats) ? pats : pats.items || [];

  const filtered = list.filter(p => {
    const st = (p.status || 'ACTIVE').toUpperCase();
    const matchesFilter = f === 'ALL' || st === f;
    const term = q.toLowerCase().trim();
    const matchesQuery = !term ||
      (p.name && p.name.toLowerCase().includes(term)) ||
      (p.phone && p.phone.toLowerCase().includes(term)) ||
      (p.email && p.email.toLowerCase().includes(term));
    return matchesFilter && matchesQuery;
  });

  const handleSaveEdit = async () => {
    if (!editingPat) return;
    try {
      const payload = {
        name: editingPat.name,
        phone: editingPat.phone,
        email: editingPat.email,
        height_cm: Number(editingPat.height_cm) || null,
        weight_kg: Number(editingPat.weight_kg) || null,
        status: editingPat.status || 'ACTIVE'
      };
      await act('PATCH', `/admin/patients/${editingPat.id}`, payload);
      setPats(x => (Array.isArray(x) ? x : x.items).map(y => y.id === editingPat.id ? { ...y, ...payload } : y));
      toast(`Updated patient ${editingPat.name}`);
      setEditingPat(null);
    } catch (e) { toast(e.message); }
  };

  const handleDeletePatient = async (p) => {
    if (!window.confirm(`Delete patient record for ${p.name}?`)) return;
    try {
      await act('DELETE', `/admin/patients/${p.id}`);
      setPats(x => (Array.isArray(x) ? x : x.items).filter(y => y.id !== p.id));
      toast(`Deleted patient ${p.name}`);
    } catch (e) { toast(e.message); }
  };

  const handleCreateSingle = async (e) => {
    e.preventDefault();
    if (!newPat.name || !newPat.phone) return toast('Name and phone are required');
    try {
      const payload = {
        ...newPat,
        height_cm: Number(newPat.height_cm) || null,
        weight_kg: Number(newPat.weight_kg) || null
      };
      const created = await act('POST', '/admin/patients', payload);
      const toAdd = created || { id: Date.now(), ...payload };
      setPats(x => [toAdd, ...(Array.isArray(x) ? x : x.items)]);
      toast(`Created patient ${newPat.name}`);
      setShowAddModal(false);
      setNewPat({ name: '', phone: '', email: '', height_cm: 170, weight_kg: 68, status: 'ACTIVE' });
    } catch (err) { toast(err.message); }
  };

  const handleBulkImport = async () => {
    let parsed = [];
    try {
      parsed = JSON.parse(bulkText);
      if (!Array.isArray(parsed)) parsed = parsed.patients || [];
    } catch {
      const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
      parsed = lines.map((line, idx) => {
        const parts = line.split(',').map(p => p.trim());
        return {
          name: parts[0] || `Patient ${idx + 1}`,
          phone: parts[1] || `+9199000${String(idx).padStart(5, '0')}`,
          email: parts[2] || `patient${idx + 1}@example.com`,
          height_cm: Number(parts[3]) || 165,
          weight_kg: Number(parts[4]) || 60,
          status: 'ACTIVE'
        };
      });
    }

    if (!parsed.length) return toast('No valid patient entries found to import');

    try {
      const res = await act('POST', '/admin/patients/bulk', { patients: parsed });
      const addedCount = res?.createdCount ?? parsed.length;
      setPats(x => [...parsed.map((p, i) => ({ id: Date.now() + i, ...p })), ...(Array.isArray(x) ? x : x.items)]);
      toast(`Successfully imported ${addedCount} patients!`);
      setShowBulkModal(false);
      setBulkText('');
    } catch (err) { toast(err.message); }
  };

  return <>
    {err && <p className="note">Showing sample data. {err}</p>}
    <div className="admin-header-row">
      <div className="pills" style={{ margin: 0 }}>
        {['ALL', 'ACTIVE', 'SUSPENDED'].map(x => (
          <button key={x} aria-pressed={f === x} onClick={() => setF(x)}>{x[0] + x.slice(1).toLowerCase()}</button>
        ))}
      </div>
      <div className="qa" style={{ margin: 0 }}>
        <input
          className="admin-search-input"
          placeholder="Search by name, phone, email..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <button className="qb pri" onClick={() => setShowAddModal(true)}>+ Add Patient</button>
        <button className="qb dk" onClick={() => setShowBulkModal(true)}>⚡ Bulk Add Patients</button>
      </div>
    </div>

    <Card>
      <Table rows={filtered} cols={[
        { h: 'Patient', r: r => <div><b>{r.name}</b><span className="sub">{r.email || 'No email registered'}</span></div> },
        { h: 'Phone', k: 'phone' },
        { h: 'Physical Vitals', r: r => <span>{r.height_cm ? `${r.height_cm} cm` : '—'} · {r.weight_kg ? `${r.weight_kg} kg` : '—'}</span> },
        { h: 'Status', r: r => <Chip s={r.status || 'ACTIVE'} /> },
        { h: 'Actions', r: r => <div className="qa" style={{ margin: 0 }}>
          <button className="sm" onClick={() => setEditingPat({ ...r })}>Edit</button>
          <button className="sm" onClick={() => {
            const nextStatus = r.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
            act('PATCH', `/admin/patients/${r.id}`, { status: nextStatus })
              .then(() => {
                setPats(x => (Array.isArray(x) ? x : x.items).map(y => y.id === r.id ? { ...y, status: nextStatus } : y));
                toast(`${r.name} marked ${nextStatus}`);
              });
          }}>{r.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}</button>
          <button className="sm" style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }} onClick={() => handleDeletePatient(r)}>Delete</button>
        </div> },
      ]} />
    </Card>

    {/* Single Add Patient Modal */}
    {showAddModal && (
      <Modal title="Add New Patient (Single Record)" onClose={() => setShowAddModal(false)}>
        <form onSubmit={handleCreateSingle}>
          <div className="fm">
            <label>Patient Full Name *<input required value={newPat.name} onChange={e => setNewPat({ ...newPat, name: e.target.value })} placeholder="Sunita Sharma" /></label>
            <label>Phone Number *<input required value={newPat.phone} onChange={e => setNewPat({ ...newPat, phone: e.target.value })} placeholder="+91 98765 12345" /></label>
            <label>Email Address<input type="email" value={newPat.email} onChange={e => setNewPat({ ...newPat, email: e.target.value })} placeholder="sunita@example.com" /></label>
            <label>Height (cm)<input type="number" step="0.5" value={newPat.height_cm} onChange={e => setNewPat({ ...newPat, height_cm: e.target.value })} placeholder="165" /></label>
            <label>Weight (kg)<input type="number" step="0.5" value={newPat.weight_kg} onChange={e => setNewPat({ ...newPat, weight_kg: e.target.value })} placeholder="62" /></label>
            <label>Account Status
              <select value={newPat.status} onChange={e => setNewPat({ ...newPat, status: e.target.value })}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            </label>
          </div>
          <div className="modal-footer" style={{ marginTop: 16 }}>
            <button type="button" className="qb" onClick={() => setShowAddModal(false)}>Cancel</button>
            <button type="submit" className="qb pri">Create Patient</button>
          </div>
        </form>
      </Modal>
    )}

    {/* Bulk Add Patients Modal */}
    {showBulkModal && (
      <Modal title="Bulk Import Patients (Large List)" wide onClose={() => setShowBulkModal(false)}>
        <div>
          <div className="admin-sample-bar">
            <span>Paste JSON array or comma-separated rows (Name, Phone, Email, Height, Weight)</span>
            <div className="qa" style={{ margin: 0 }}>
              <button type="button" className="sm" onClick={() => setBulkText(JSON.stringify(SAMPLE_BULK_PATIENTS, null, 2))}>Load 10 Sample Patients</button>
              <button type="button" className="sm" onClick={() => setBulkText('')}>Clear</button>
            </div>
          </div>
          <textarea
            className="admin-bulk-area"
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            placeholder="[&#10;  { &quot;name&quot;: &quot;Aarav Malhotra&quot;, &quot;phone&quot;: &quot;+91 99201 11001&quot;, &quot;height_cm&quot;: 178, &quot;weight_kg&quot;: 74 }&#10;]&#10;or:&#10;Aarav Malhotra, +919920111001, aarav@example.com, 178, 74"
          />
          <div className="modal-footer" style={{ marginTop: 16 }}>
            <button type="button" className="qb" onClick={() => setShowBulkModal(false)}>Cancel</button>
            <button type="button" className="qb pri" disabled={!bulkText.trim()} onClick={handleBulkImport}>Import Patients Now</button>
          </div>
        </div>
      </Modal>
    )}

    {/* Edit Patient Modal */}
    {editingPat && (
      <Modal title={`Edit Patient — ${editingPat.name}`} onClose={() => setEditingPat(null)}>
        <div className="fm">
          <label>Full Name *<input value={editingPat.name} onChange={e => setEditingPat({ ...editingPat, name: e.target.value })} /></label>
          <label>Phone Number *<input value={editingPat.phone} onChange={e => setEditingPat({ ...editingPat, phone: e.target.value })} /></label>
          <label>Email Address<input type="email" value={editingPat.email || ''} onChange={e => setEditingPat({ ...editingPat, email: e.target.value })} /></label>
          <label>Height (cm)<input type="number" step="0.5" value={editingPat.height_cm || ''} onChange={e => setEditingPat({ ...editingPat, height_cm: e.target.value })} /></label>
          <label>Weight (kg)<input type="number" step="0.5" value={editingPat.weight_kg || ''} onChange={e => setEditingPat({ ...editingPat, weight_kg: e.target.value })} /></label>
          <label>Account Status
            <select value={editingPat.status || 'ACTIVE'} onChange={e => setEditingPat({ ...editingPat, status: e.target.value })}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          </label>
        </div>
        <div className="modal-footer" style={{ marginTop: 16 }}>
          <button type="button" className="qb" onClick={() => setEditingPat(null)}>Cancel</button>
          <button type="button" className="qb pri" onClick={handleSaveEdit}>Save Patient Profile</button>
        </div>
      </Modal>
    )}
  </>;
}

// ──────────────────────────────────────────
// APPOINTMENTS (Direct Booking, Status Modification, Reschedule, Cancellation)
// ──────────────────────────────────────────
function Apps() {
  const [apps, setApps, err] = useData('/admin/appointments', M.apps);
  const [f, setF] = useState('ALL');
  const [q, setQ] = useState('');

  const [showBookModal, setShowBookModal] = useState(false);
  const [editingApt, setEditingApt] = useState(null);

  const [newApt, setNewApt] = useState({
    patient_id: 1, doctor_id: 1, appointment_date: new Date().toISOString().slice(0, 10),
    start_time: '11:00:00', consultation_mode: 'VIDEO', status: 'CONFIRMED',
    platform_fee: 99, meeting_url: 'https://meet.google.com/med-consultation'
  });

  if (!apps) return null;
  const list = Array.isArray(apps) ? apps : apps.items || [];

  const filtered = list.filter(a => {
    const st = (a.status || '').toUpperCase();
    const matchesFilter = f === 'ALL' || st === f;
    const term = q.toLowerCase().trim();
    const pName = a.patient_name || a.patient || '';
    const dName = a.doctor_name || a.doctor || '';
    const aptNo = a.appointment_number || '';
    const matchesQuery = !term ||
      pName.toLowerCase().includes(term) ||
      dName.toLowerCase().includes(term) ||
      aptNo.toLowerCase().includes(term);
    return matchesFilter && matchesQuery;
  });

  const handleSaveEdit = async () => {
    if (!editingApt) return;
    try {
      const payload = {
        status: editingApt.status,
        appointment_date: editingApt.appointment_date,
        start_time: editingApt.start_time,
        consultation_mode: editingApt.consultation_mode || editingApt.mode,
        meeting_url: editingApt.meeting_url || null,
        cancellation_reason: editingApt.cancellation_reason || null,
        platform_fee: Number(editingApt.platform_fee) || 99
      };
      await act('PATCH', `/admin/appointments/${editingApt.id}`, payload);
      setApps(x => (Array.isArray(x) ? x : x.items).map(y => y.id === editingApt.id ? { ...y, ...payload } : y));
      toast('Appointment updated successfully');
      setEditingApt(null);
    } catch (e) { toast(e.message); }
  };

  const handleCancelApt = async (a) => {
    const reason = window.prompt('Reason for cancellation:', 'Admin cancelled session');
    if (!reason) return;
    try {
      await act('PATCH', `/admin/appointments/${a.id}`, { status: 'CANCELLED', cancellation_reason: reason });
      setApps(x => (Array.isArray(x) ? x : x.items).map(y => y.id === a.id ? { ...y, status: 'CANCELLED', cancellation_reason: reason } : y));
      toast('Appointment cancelled');
    } catch (e) { toast(e.message); }
  };

  const handleDeleteApt = async (a) => {
    if (!window.confirm('Delete this appointment completely?')) return;
    try {
      await act('DELETE', `/admin/appointments/${a.id}`);
      setApps(x => (Array.isArray(x) ? x : x.items).filter(y => y.id !== a.id));
      toast('Appointment deleted');
    } catch (e) { toast(e.message); }
  };

  const handleCreateApt = async (e) => {
    e.preventDefault();
    try {
      const created = await act('POST', '/admin/appointments', newApt);
      const toAdd = created || { id: Date.now(), ...newApt, patient: `Patient #${newApt.patient_id}`, doctor: `Doctor #${newApt.doctor_id}`, when: `${newApt.appointment_date} ${newApt.start_time}` };
      setApps(x => [toAdd, ...(Array.isArray(x) ? x : x.items)]);
      toast('Appointment scheduled');
      setShowBookModal(false);
    } catch (err) { toast(err.message); }
  };

  return <>
    {err && <p className="note">Showing sample data. {err}</p>}
    <div className="admin-header-row">
      <div className="pills" style={{ margin: 0 }}>
        {['ALL', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'HELD'].map(x => (
          <button key={x} aria-pressed={f === x} onClick={() => setF(x)}>{x[0] + x.slice(1).toLowerCase()}</button>
        ))}
      </div>
      <div className="qa" style={{ margin: 0 }}>
        <input
          className="admin-search-input"
          placeholder="Search by patient, doctor, apt#..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <button className="qb pri" onClick={() => setShowBookModal(true)}>+ Schedule Appointment</button>
      </div>
    </div>

    <Card>
      <Table rows={filtered} cols={[
        { h: 'Booking Details', r: a => <div><b>{a.appointment_number || `APT-#${a.id}`}</b><span className="sub">{a.when || `${a.appointment_date} ${a.start_time}`}</span></div> },
        { h: 'Patient & Doctor', r: a => <div><span>Patient: <b>{a.patient_name || a.patient}</b></span><span className="sub">Doctor: <b>{a.doctor_name || a.doctor}</b></span></div> },
        { h: 'Consultation Mode', r: a => <div><span>{a.consultation_mode || a.mode || 'VIDEO'}</span>{a.meeting_url && <a href={a.meeting_url} target="_blank" rel="noreferrer" className="sub" style={{ color: 'var(--or)' }}>Open Meeting Link</a>}</div> },
        { h: 'Fee', r: a => <b>{inr(a.platform_fee || 99)}</b> },
        { h: 'Status', r: a => <Chip s={a.status} /> },
        { h: 'Actions', r: a => <div className="qa" style={{ margin: 0 }}>
          <button className="sm" onClick={() => setEditingApt({ ...a })}>Modify</button>
          {a.status !== 'COMPLETED' && <button className="sm" onClick={() => {
            act('PATCH', `/admin/appointments/${a.id}`, { status: 'COMPLETED' })
              .then(() => {
                setApps(x => (Array.isArray(x) ? x : x.items).map(y => y.id === a.id ? { ...y, status: 'COMPLETED' } : y));
                toast('Marked consultation COMPLETED');
              });
          }}>Complete</button>}
          {a.status !== 'CANCELLED' && <button className="sm" onClick={() => handleCancelApt(a)}>Cancel</button>}
          <button className="sm" style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }} onClick={() => handleDeleteApt(a)}>Delete</button>
        </div> },
      ]} />
    </Card>

    {/* Direct Booking Modal */}
    {showBookModal && (
      <Modal title="Schedule Appointment Directly as Admin" onClose={() => setShowBookModal(false)}>
        <form onSubmit={handleCreateApt}>
          <div className="fm">
            <label>Patient ID<input type="number" min="1" value={newApt.patient_id} onChange={e => setNewApt({ ...newApt, patient_id: Number(e.target.value) })} /></label>
            <label>Doctor ID<input type="number" min="1" value={newApt.doctor_id} onChange={e => setNewApt({ ...newApt, doctor_id: Number(e.target.value) })} /></label>
            <label>Date (YYYY-MM-DD)<input type="date" value={newApt.appointment_date} onChange={e => setNewApt({ ...newApt, appointment_date: e.target.value })} /></label>
            <label>Start Time (HH:MM)<input type="time" value={newApt.start_time.slice(0, 5)} onChange={e => setNewApt({ ...newApt, start_time: `${e.target.value}:00` })} /></label>
            <label>Consultation Mode
              <select value={newApt.consultation_mode} onChange={e => setNewApt({ ...newApt, consultation_mode: e.target.value })}>
                <option value="VIDEO">VIDEO (Online)</option>
                <option value="AUDIO">AUDIO (Voice)</option>
                <option value="FACE_TO_FACE">FACE_TO_FACE (Clinic Visit)</option>
              </select>
            </label>
            <label>Status
              <select value={newApt.status} onChange={e => setNewApt({ ...newApt, status: e.target.value })}>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="HELD">HELD</option>
                <option value="PAYMENT_PENDING">PAYMENT_PENDING</option>
              </select>
            </label>
            <label>Platform Fee (₹)<input type="number" min="0" value={newApt.platform_fee} onChange={e => setNewApt({ ...newApt, platform_fee: Number(e.target.value) })} /></label>
            <label className="full">Video Meeting URL<input value={newApt.meeting_url} onChange={e => setNewApt({ ...newApt, meeting_url: e.target.value })} placeholder="https://meet.google.com/xyz" /></label>
          </div>
          <div className="modal-footer" style={{ marginTop: 16 }}>
            <button type="button" className="qb" onClick={() => setShowBookModal(false)}>Cancel</button>
            <button type="submit" className="qb pri">Schedule Appointment</button>
          </div>
        </form>
      </Modal>
    )}

    {/* Modify Appointment Modal */}
    {editingApt && (
      <Modal title={`Modify Appointment #${editingApt.appointment_number || editingApt.id}`} onClose={() => setEditingApt(null)}>
        <div className="fm">
          <label>Status
            <select value={editingApt.status} onChange={e => setEditingApt({ ...editingApt, status: e.target.value })}>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="RESCHEDULED">RESCHEDULED</option>
              <option value="NO_SHOW">NO_SHOW</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="WAITING">WAITING</option>
              <option value="HELD">HELD</option>
            </select>
          </label>
          <label>Date<input type="date" value={(editingApt.appointment_date || '').slice(0, 10)} onChange={e => setEditingApt({ ...editingApt, appointment_date: e.target.value })} /></label>
          <label>Start Time<input type="time" value={(editingApt.start_time || '10:00:00').slice(0, 5)} onChange={e => setEditingApt({ ...editingApt, start_time: `${e.target.value}:00` })} /></label>
          <label>Mode
            <select value={editingApt.consultation_mode || editingApt.mode} onChange={e => setEditingApt({ ...editingApt, consultation_mode: e.target.value, mode: e.target.value })}>
              <option value="VIDEO">VIDEO</option>
              <option value="AUDIO">AUDIO</option>
              <option value="FACE_TO_FACE">FACE_TO_FACE</option>
            </select>
          </label>
          <label>Platform Fee (₹)<input type="number" min="0" value={editingApt.platform_fee || 99} onChange={e => setEditingApt({ ...editingApt, platform_fee: Number(e.target.value) })} /></label>
          <label className="full">Meeting URL<input value={editingApt.meeting_url || ''} onChange={e => setEditingApt({ ...editingApt, meeting_url: e.target.value })} placeholder="https://meet.google.com/..." /></label>
          <label className="full">Cancellation / Admin Reason<textarea rows={2} value={editingApt.cancellation_reason || ''} onChange={e => setEditingApt({ ...editingApt, cancellation_reason: e.target.value })} placeholder="Reason for status change or rescheduling..." /></label>
        </div>
        <div className="modal-footer" style={{ marginTop: 16 }}>
          <button type="button" className="qb" onClick={() => setEditingApt(null)}>Cancel</button>
          <button type="button" className="qb pri" onClick={handleSaveEdit}>Update Appointment</button>
        </div>
      </Modal>
    )}
  </>;
}

// ──────────────────────────────────────────
// DEPARTMENTS MANAGEMENT
// ──────────────────────────────────────────
function Depts() {
  const [depts, setDepts, err] = useData('/admin/departments', M.depts);
  const [showAdd, setShowAdd] = useState(false);
  const [newDept, setNewDept] = useState({ name: '', description: '', status: 'ACTIVE' });

  if (!depts) return null;
  const list = Array.isArray(depts) ? depts : depts.items || [];

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newDept.name) return toast('Department name is required');
    try {
      const created = await act('POST', '/admin/departments', newDept);
      setDepts(x => [created || { id: Date.now(), ...newDept }, ...(Array.isArray(x) ? x : x.items)]);
      toast(`Department ${newDept.name} added`);
      setShowAdd(false);
      setNewDept({ name: '', description: '', status: 'ACTIVE' });
    } catch (e) { toast(e.message); }
  };

  const handleDelete = async (d) => {
    if (!window.confirm(`Delete department ${d.name}?`)) return;
    try {
      await act('DELETE', `/admin/departments/${d.id}`);
      setDepts(x => (Array.isArray(x) ? x : x.items).filter(y => y.id !== d.id));
      toast(`Deleted department ${d.name}`);
    } catch (e) { toast(e.message); }
  };

  return <>
    {err && <p className="note">Showing sample data. {err}</p>}
    <div className="admin-header-row">
      <h3 style={{ margin: 0 }}>Clinical Departments Catalog</h3>
      <button className="qb pri" onClick={() => setShowAdd(true)}>+ Add Department</button>
    </div>
    <Card>
      <Table rows={list} cols={[
        { h: 'Department Name', r: r => <div><b>{r.name}</b><span className="sub">{r.description || 'Clinical specialty'}</span></div> },
        { h: 'Status', r: r => <Chip s={r.status || (r.is_active ? 'ACTIVE' : 'INACTIVE')} /> },
        { h: 'Actions', r: r => <div className="qa" style={{ margin: 0 }}>
          <button className="sm" onClick={() => {
            const nextStatus = r.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
            act('PATCH', `/admin/departments/${r.id}`, { status: nextStatus })
              .then(() => {
                setDepts(x => (Array.isArray(x) ? x : x.items).map(y => y.id === r.id ? { ...y, status: nextStatus } : y));
                toast(`${r.name} set to ${nextStatus}`);
              });
          }}>{r.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button>
          <button className="sm" style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }} onClick={() => handleDelete(r)}>Delete</button>
        </div> }
      ]} />
    </Card>

    {showAdd && (
      <Modal title="Add Department" onClose={() => setShowAdd(false)}>
        <form onSubmit={handleCreate}>
          <div className="fm">
            <label>Department Name *<input required value={newDept.name} onChange={e => setNewDept({ ...newDept, name: e.target.value })} placeholder="Oncology" /></label>
            <label>Status
              <select value={newDept.status} onChange={e => setNewDept({ ...newDept, status: e.target.value })}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </label>
            <label className="full">Description<textarea rows={2} value={newDept.description} onChange={e => setNewDept({ ...newDept, description: e.target.value })} placeholder="Specialized diagnosis and cancer therapy care..." /></label>
          </div>
          <div className="modal-footer" style={{ marginTop: 16 }}>
            <button type="button" className="qb" onClick={() => setShowAdd(false)}>Cancel</button>
            <button type="submit" className="qb pri">Add Department</button>
          </div>
        </form>
      </Modal>
    )}
  </>;
}

// ──────────────────────────────────────────
// PAYMENTS MANAGEMENT
// ──────────────────────────────────────────
function Pay() {
  const [pay, setPay, err] = useData('/admin/payments', M.pay);
  const [f, setF] = useState('ALL');
  const [editingPay, setEditingPay] = useState(null);

  if (!pay) return null;
  const list = Array.isArray(pay) ? pay : pay.items || [];
  const filtered = list.filter(p => f === 'ALL' || (p.status || '').toUpperCase() === f);

  const handleUpdate = async () => {
    if (!editingPay) return;
    try {
      await act('PATCH', `/admin/payments/${editingPay.id}`, {
        status: editingPay.status,
        amount: Number(editingPay.amount) || undefined
      });
      setPay(x => (Array.isArray(x) ? x : x.items).map(y => y.id === editingPay.id ? { ...y, ...editingPay } : y));
      toast('Payment updated');
      setEditingPay(null);
    } catch (e) { toast(e.message); }
  };

  return <>
    {err && <p className="note">Showing sample data. {err}</p>}
    <div className="admin-header-row">
      <div className="pills" style={{ margin: 0 }}>
        {['ALL', 'SUCCESS', 'PENDING', 'FAILED', 'REFUNDED'].map(x => (
          <button key={x} aria-pressed={f === x} onClick={() => setF(x)}>{x[0] + x.slice(1).toLowerCase()}</button>
        ))}
      </div>
    </div>
    <Card>
      <Table rows={filtered} cols={[
        { h: 'Reference / Order', r: r => <div><b>{r.ref || r.gateway_order_id || `PAY-#${r.id}`}</b><span className="sub">Apt: {r.appointment_number || `#${r.appointment_id || ''}`}</span></div> },
        { h: 'Patient', r: r => <span>{r.patient || r.patient_name || 'Patient'}</span> },
        { h: 'Amount', r: r => <b>{inr(r.amount || 99)}</b> },
        { h: 'Status', r: r => <Chip s={r.status} /> },
        { h: 'Actions', r: r => <div className="qa" style={{ margin: 0 }}>
          <button className="sm" onClick={() => setEditingPay({ ...r })}>Modify</button>
          {r.status === 'SUCCESS' && <button className="sm" onClick={() => {
            if (!window.confirm('Process refund for this payment?')) return;
            act('PATCH', `/admin/payments/${r.id}`, { status: 'REFUNDED' })
              .then(() => {
                setPay(x => (Array.isArray(x) ? x : x.items).map(y => y.id === r.id ? { ...y, status: 'REFUNDED' } : y));
                toast('Payment marked REFUNDED');
              });
          }}>Refund</button>}
        </div> }
      ]} />
    </Card>

    {editingPay && (
      <Modal title={`Modify Payment — ${editingPay.ref || editingPay.id}`} onClose={() => setEditingPay(null)}>
        <div className="fm">
          <label>Status
            <select value={editingPay.status} onChange={e => setEditingPay({ ...editingPay, status: e.target.value })}>
              <option value="SUCCESS">SUCCESS</option>
              <option value="PENDING">PENDING</option>
              <option value="FAILED">FAILED</option>
              <option value="REFUNDED">REFUNDED</option>
              <option value="REFUND_PENDING">REFUND_PENDING</option>
            </select>
          </label>
          <label>Amount (₹)<input type="number" min="0" value={editingPay.amount || 99} onChange={e => setEditingPay({ ...editingPay, amount: Number(e.target.value) })} /></label>
        </div>
        <div className="modal-footer" style={{ marginTop: 16 }}>
          <button type="button" className="qb" onClick={() => setEditingPay(null)}>Cancel</button>
          <button type="button" className="qb pri" onClick={handleUpdate}>Save Payment Status</button>
        </div>
      </Modal>
    )}
  </>;
}

// ──────────────────────────────────────────
// SETTINGS
// ──────────────────────────────────────────
function Settings() {
  const [s, , err] = useData('/admin/settings', { platform_fee: 99 });
  const [fee, setFee] = useState(null);
  if (!s) return null;
  const val = fee ?? s.platform_fee ?? 99;
  const save = async () => {
    if (!(+val > 0)) return toast('Enter a fee above zero');
    try {
      await act('PATCH', '/admin/settings', { platformFee: +val, platform_fee: +val });
      toast('Platform fee saved');
    } catch (e) { toast(e.message); }
  };
  return <>{err && <p className="note">Showing sample data. {err}</p>}
    <Card title="Platform Platform Fee Settings">
      <div className="fm">
        <label>Platform Fee per booking (₹)
          <input type="number" min="1" value={val} onChange={e => setFee(e.target.value)} />
        </label>
      </div>
      <div className="qa" style={{ marginTop: 14 }}>
        <button className="qb pri" onClick={save}>Save Platform Fee</button>
      </div>
    </Card>
  </>;
}

// ──────────────────────────────────────────
// AUDIT LOGS
// ──────────────────────────────────────────
function Log() {
  const [logs, , err] = useData('/admin/audit-logs', M.log);
  if (!logs) return null;
  const rows = Array.isArray(logs) ? logs : logs.items || [];
  return <>
    {err && <p className="note">Showing sample data. {err}</p>}
    <Card title="System Audit Logs">
      <Table rows={rows} cols={[
        { h: 'Timestamp', r: r => <span>{r.at || r.created_at || 'Just now'}</span> },
        { h: 'Actor & Role', r: r => <span>{r.actor || r.role || `User #${r.user_id || '1'}`}</span> },
        { h: 'Action Type', r: r => <Chip s={r.action} /> },
        { h: 'Resource Target', r: r => <span>{r.target || `${r.resource_type || ''} #${r.resource_id || ''}`}</span> },
      ]} />
    </Card>
  </>;
}

export const adminPages = {
  dash: Dash,
  docs: Docs,
  pats: Pats,
  depts: Depts,
  apps: Apps,
  pay: Pay,
  set: Settings,
  log: Log,
};
