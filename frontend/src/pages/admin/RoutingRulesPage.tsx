import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../api';
import { assetTypes, locations, users } from '../../data/referenceData';
import type { RoutingRule } from '../../domain/types';
import { useSession } from '../../state/session';
import './Management.css';
export default function RoutingRulesPage() {
  const { refreshReference } = useSession();
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [locationId, setLocationId] = useState(''); const [assetTypeId, setAssetTypeId] = useState(''); const [subAdminId, setSubAdminId] = useState('');
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  async function reload() { setRules(await api('/routing/rules')); await refreshReference(); }
  useEffect(() => { void reload().catch(e => setError(e.message)); }, []);
  async function create(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { await api('/routing/rules', { method: 'POST', body: JSON.stringify({ locationId, assetTypeId, subAdminId }) }); await reload(); setNotice('Routing rule added. The most specific matching location wins.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not add routing rule.'); } finally { setBusy(false); }
  }
  async function update(rule: RoutingRule, values: object) { try { await api(`/routing/rules/${rule.id}`, { method: 'PATCH', body: JSON.stringify(values) }); await reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update rule.'); } }
  return <div className="dash"><div className="page-head"><div><h2>Routing Rules</h2><p>Map each location and asset type to the responsible active Sub-Admin.</p></div></div>
    {error && <p role="alert" className="manage-error">{error}</p>}{notice && <p role="status" className="manage-state">{notice}</p>}
    <div className="manage-grid"><section className="panel glass manage-panel"><h3>Add routing rule</h3><form className="manage-form" onSubmit={create}>
      <label>Location<select className="select" required value={locationId} onChange={e => setLocationId(e.target.value)}><option value="">Select location…</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name} · {l.type}</option>)}</select></label>
      <label>Asset type<select className="select" required value={assetTypeId} onChange={e => setAssetTypeId(e.target.value)}><option value="">Select asset…</option>{assetTypes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <label>Sub-Admin<select className="select" required value={subAdminId} onChange={e => setSubAdminId(e.target.value)}><option value="">Select resolver…</option>{users.filter(u => u.role === 'SUB_ADMIN').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
      <button className="btn btn-primary" disabled={busy}>Add rule</button>
    </form></section><section className="panel glass manage-panel"><h3>Current rules</h3><div className="manage-table-wrap"><table className="manage-table"><thead><tr><th>Location</th><th>Asset</th><th>Sub-Admin</th><th>Status</th><th>Action</th></tr></thead><tbody>{rules.map(rule => <tr key={rule.id}><td>{locations.find(l => l.id === rule.locationId)?.name || rule.locationId}</td><td>{assetTypes.find(a => a.id === rule.assetTypeId)?.name || rule.assetTypeId}</td><td><select className="select" value={rule.subAdminId} onChange={e => void update(rule, { subAdminId: e.target.value })}>{users.filter(u => u.role === 'SUB_ADMIN').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></td><td>{rule.active ? 'Active' : 'Inactive'}</td><td><button className="btn btn-ghost" onClick={() => void update(rule, { active: !rule.active })}>{rule.active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div>{!rules.length && <p className="manage-note">Add a rule to automatically assign new tickets.</p>}</section></div>
  </div>;
}
