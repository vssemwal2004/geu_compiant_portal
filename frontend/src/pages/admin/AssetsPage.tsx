import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../api';
import type { AssetType, TicketPriority } from '../../domain/types';
import { useSession } from '../../state/session';
import './Management.css';
export default function AssetsPage() {
  const { refreshReference } = useSession();
  const [items, setItems] = useState<(AssetType & { active?: boolean })[]>([]);
  const [name, setName] = useState(''); const [code, setCode] = useState(''); const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  async function reload() { setItems(await api('/admin/asset-types?includeInactive=true')); await refreshReference(); }
  useEffect(() => { void reload().catch(e => setError(e.message)); }, []);
  async function create(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { await api('/admin/asset-types', { method: 'POST', body: JSON.stringify({ name, code, defaultPriority: priority }) }); await reload(); setName(''); setCode(''); setNotice('Asset type added.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not add asset type.'); } finally { setBusy(false); }
  }
  async function update(item: AssetType & { active?: boolean }, values: object) { try { await api(`/admin/asset-types/${item.id}`, { method: 'PATCH', body: JSON.stringify(values) }); await reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update asset type.'); } }
  return <div className="dash"><div className="page-head"><div><h2>Asset Types</h2><p>Set categories and their default ticket priority.</p></div></div>
    {error && <p role="alert" className="manage-error">{error}</p>}{notice && <p role="status" className="manage-state">{notice}</p>}
    <div className="manage-grid"><section className="panel glass manage-panel"><h3>Add asset type</h3><form className="manage-form" onSubmit={create}>
      <label>Name<input className="input" required maxLength={60} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Computer" /></label>
      <label>Code<input className="input" required pattern="[A-Za-z0-9_-]{2,12}" maxLength={12} value={code} onChange={e => setCode(e.target.value)} placeholder="COMP" /></label>
      <label>Default priority<select className="select" value={priority} onChange={e => setPriority(e.target.value as TicketPriority)}>{(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as TicketPriority[]).map(p => <option key={p}>{p}</option>)}</select></label>
      <button className="btn btn-primary" disabled={busy}>Add asset type</button>
    </form></section><section className="panel glass manage-panel"><h3>Configured types</h3><div className="manage-table-wrap"><table className="manage-table"><thead><tr><th>Name</th><th>Code</th><th>Default priority</th><th>Status</th><th>Action</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.code}</td><td><select className="select" value={item.defaultPriority} onChange={e => void update(item, { defaultPriority: e.target.value })}>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => <option key={p}>{p}</option>)}</select></td><td>{item.active === false ? 'Inactive' : 'Active'}</td><td><button className="btn btn-ghost" onClick={() => void update(item, { active: item.active === false })}>{item.active === false ? 'Activate' : 'Deactivate'}</button></td></tr>)}</tbody></table></div>{!items.length && <p className="manage-note">Add an asset type to begin.</p>}</section></div>
  </div>;
}
