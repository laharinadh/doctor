import { useData } from './api';

export const toast = m => window.dispatchEvent(new CustomEvent('toast', { detail: m }));
export const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN');

export const Card = ({ title, right, children, className = '' }) => (
  <section className={'card ' + className}>
    {(title || right) && <header><h3>{title}</h3>{right}</header>}
    {children}
  </section>
);

export const Stat = ({ v, l, s, ic }) => (
  <div className="card stat"><i className="ic">{ic}</i><b>{v}</b><span>{l}</span><small>{s}</small></div>
);

const TONE = { ok: ['APPROVED', 'CONFIRMED', 'COMPLETED', 'SUCCESS', 'SUCCESSFUL', 'ACTIVE', 'PAID'], warn: ['PENDING', 'SCHEDULED', 'IN_PROGRESS', 'HELD', 'WAITING'], bad: ['REJECTED', 'SUSPENDED', 'CANCELLED', 'FAILED', 'NO_SHOW', 'REFUNDED'] };
export const Chip = ({ s }) => {
  const k = String(s || '').toUpperCase().replace(/ /g, '_');
  const t = Object.keys(TONE).find(x => TONE[x].includes(k)) || '';
  const label = k === 'WAITING' ? 'Awaiting Doctor Confirmation' : String(s || '').replace(/_/g, ' ').toLowerCase();
  return <span className={'ch ' + t}>{label}</span>;
};

export const Table = ({ cols, rows, empty = 'Nothing here yet.' }) =>
  rows.length ? (
    <div className="tw"><table className="tb">
      <thead><tr>{cols.map(c => <th key={c.h}>{c.h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={r.id ?? i}>{cols.map(c => <td key={c.h}>{c.r ? c.r(r) : r[c.k]}</td>)}</tr>)}</tbody>
    </table></div>
  ) : <p className="empty">{empty}</p>;

export function List({ path, mock, cols }) {
  const [d, , err] = useData(path, mock);
  if (!d) return <Card><p className="empty">Loading…</p></Card>;
  const rows = Array.isArray(d) ? d : d.items || d.rows || d.data || [];
  return <>{err && <p className="note">Showing sample data. {err}</p>}<Card><Table cols={cols} rows={rows} /></Card></>;
}

export function Line({ data, h = 200 }) {
  const w = 640, mx = Math.max(...data, 1), st = w / (data.length - 1);
  const p = data.map((v, i) => [i * st, h - 16 - (v / mx) * (h - 36)]);
  const d = p.map((c, i) => (i ? 'L' : 'M') + c[0].toFixed(1) + ' ' + c[1].toFixed(1)).join('');
  return (
    <svg className="line" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Trend over the last 30 days">
      <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff6a00" stopOpacity=".25" /><stop offset="1" stopColor="#ff6a00" stopOpacity="0" /></linearGradient></defs>
      {[0, .25, .5, .75, 1].map(t => <line key={t} x1="0" x2={w} y1={16 + t * (h - 36)} y2={16 + t * (h - 36)} className="grid" />)}
      <path d={d + `L${w} ${h}L0 ${h}Z`} fill="url(#lg)" />
      <path d={d} fill="none" stroke="#ff6a00" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
