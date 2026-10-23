import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../api';
import type { Location, LocationType } from '../../domain/types';
import { useSession } from '../../state/session';
import './Management.css';
const types: LocationType[] = ['CAMPUS', 'BUILDING', 'FLOOR', 'LAB'];
const parentType: Record<LocationType, LocationType | null> = { CAMPUS: null, BUILDING: 'CAMPUS', FLOOR: 'BUILDING', LAB: 'FLOOR' };
export default function LocationsPage() {
  const { refreshReference } = useSession();
  const [items, setItems] = useState<(Location & { active?: boolean })[]>([]);
  const [type, setType] = useState<LocationType>('CAMPUS');
  const [parentId, setParentId] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  async function reload() { setItems(await api('/admin/locations?includeInactive=true')); await refreshReference(); }
  useEffect(() => { void reload().catch(e => setError(e.message)); }, []);
  async function create(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { await api('/admin/locations', { method: 'POST', body: JSON.stringify({ type, parentId: parentId || undefined, name }) }); await reload(); setName(''); setNotice('Location added.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not add location.'); } finally { setBusy(false); }
  }
  async function toggle(item: Location & { active?: boolean }) {
    try { await api(`/admin/locations/${item.id}`, { method: 'PATCH', body: JSON.stringify({ active: item.active === false }) }); await reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update location.'); }
  }
  return <div className="dash"><div className="page-head"><div><h2>Locations</h2><p>Configure campus → building → floor → lab or room.</p></div></div>
    {error && <p role="alert" className="manage-error">{error}</p>}{notice && <p role="status" className="manage-state">{notice}</p>}
    <div className="manage-grid"><section className="panel glass manage-panel"><h3>Add location</h3><form className="manage-form" onSubmit={create}>
      <label>Type<select className="select" value={type} onChange={e => { setType(e.target.value as LocationType); setParentId(''); }}>{types.map(t => <option key={t} value={t}>{t === 'LAB' ? 'Lab / Room' : t.charAt(0) + t.slice(1).toLowerCase()}</option>)}</select></label>
      {parentType[type] && <label>Parent<select className="select" required value={parentId} onChange={e => setParentId(e.target.value)}><option value="">Select {parentType[type]?.toLowerCase()}…</option>{items.filter(x => x.type === parentType[type] && x.active !== false).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
      <label>Name<input className="input" required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Lab 205" /></label>
      <button className="btn btn-primary" disabled={busy}>Add location</button>
    </form></section><section className="panel glass manage-panel"><h3>Organization tree</h3><div className="manage-table-wrap"><table className="manage-table"><thead><tr><th>Name</th><th>Type</th><th>Parent</th><th>Status</th><th>Action</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.type}</td><td>{items.find(x => x.id === item.parentId)?.name || '—'}</td><td>{item.active === false ? 'Inactive' : 'Active'}</td><td><button className="btn btn-ghost" onClick={() => void toggle(item)}>{item.active === false ? 'Activate' : 'Deactivate'}</button></td></tr>)}</tbody></table></div>{!items.length && <p className="manage-note">Add a campus to begin.</p>}</section></div>
  </div>;
}
