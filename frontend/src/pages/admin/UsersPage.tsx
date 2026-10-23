import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../api';
import { locations } from '../../data/referenceData';
import type { Role, User } from '../../domain/types';
import { useSession } from '../../state/session';
import './Management.css';
type ManagedUser = User & { status: 'ACTIVE' | 'INVITED' | 'DISABLED'; scopeLocationIds?: string[]; defaultLocationId?: string };
export default function UsersPage() {
  const { refreshReference } = useSession();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [employeeId, setEmployeeId] = useState('');
  const [role, setRole] = useState<Exclude<Role, 'MAIN_ADMIN'>>('LAB_ASSISTANT'); const [phone, setPhone] = useState('');
  const [scopeId, setScopeId] = useState(''); const [defaultLocationId, setDefaultLocationId] = useState(''); const [password, setPassword] = useState('');
  const [selected, setSelected] = useState(''); const [newPassword, setNewPassword] = useState('');
  const [canEscalate, setCanEscalate] = useState(true);
  const [editId, setEditId] = useState(''); const [editName, setEditName] = useState(''); const [editPhone, setEditPhone] = useState('');
  const [editScope, setEditScope] = useState(''); const [editDefault, setEditDefault] = useState(''); const [editEscalate, setEditEscalate] = useState(true);
  async function reload() { setUsers(await api<ManagedUser[]>('/admin/users')); await refreshReference(); }
  useEffect(() => { void reload().catch(e => setError(e.message)); }, []);
  async function create(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await api('/admin/users', { method: 'POST', body: JSON.stringify({ name, email, employeeId, role, phone: role === 'LAB_ASSISTANT' ? phone : undefined,
        password: password || undefined, allowedLocationIds: role === 'LAB_ASSISTANT' ? [scopeId] : [], scopeLocationIds: role === 'SUB_ADMIN' && scopeId ? [scopeId] : [],
        defaultLocationId: role === 'LAB_ASSISTANT' ? defaultLocationId || undefined : undefined, canEscalate: role === 'SUB_ADMIN' ? canEscalate : undefined }) });
      await reload(); setName(''); setEmail(''); setEmployeeId(''); setPhone(''); setPassword('');
      setNotice(password ? 'Account created. Share the password securely.' : 'Account invited. Set a password to enable portal login.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create account.'); } finally { setBusy(false); }
  }
  async function patch(id: string, values: object, success: string) {
    setBusy(true); setError(''); setNotice('');
    try { await api(`/admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(values) }); await reload(); setNotice(success); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update account.'); } finally { setBusy(false); }
  }
  async function setAccountPassword(e: FormEvent) { e.preventDefault(); await patch(selected, { password: newPassword }, 'Password set and account activated. Share it securely.'); setNewPassword(''); setSelected(''); }
  function selectForEdit(id: string) {
    const user = users.find(u => u.id === id); setEditId(id);
    if (!user) return;
    setEditName(user.name); setEditPhone(user.phone || ''); setEditScope((user.role === 'SUB_ADMIN' ? user.scopeLocationIds : user.allowedLocationIds)?.[0] || '');
    setEditDefault(user.defaultLocationId || ''); setEditEscalate(user.permissions?.includes('ESCALATE_ASSIGNED') ?? true);
  }
  async function saveProfile(e: FormEvent) {
    e.preventDefault(); const user = users.find(u => u.id === editId); if (!user) return;
    await patch(editId, { name: editName, phone: user.role === 'LAB_ASSISTANT' ? editPhone : undefined,
      allowedLocationIds: user.role === 'LAB_ASSISTANT' ? [editScope] : undefined,
      scopeLocationIds: user.role === 'SUB_ADMIN' ? editScope ? [editScope] : [] : undefined,
      defaultLocationId: user.role === 'LAB_ASSISTANT' ? editDefault : undefined,
      canEscalate: user.role === 'SUB_ADMIN' ? editEscalate : undefined }, 'Account details updated.');
  }
  const selectable = locations.filter(l => l.type === 'CAMPUS' || l.type === 'BUILDING');
  const defaultOptions = locations.filter(l => l.type === 'LAB' && (!scopeId || l.id === scopeId || locations.some(x => x.id === l.parentId && (x.id === scopeId || x.parentId === scopeId)) || locations.some(x => x.id === l.parentId && locations.some(y => y.id === x.parentId && y.parentId === scopeId))));
  return <div className="dash"><div className="page-head"><div><h2>Users</h2><p>Create Sub-Admins and Lab Assistants, assign scopes, and manage account status.</p></div></div>
    {error && <p role="alert" className="manage-error">{error}</p>}{notice && <p role="status" className="manage-state">{notice}</p>}
    <div className="manage-grid"><section className="panel glass manage-panel"><h3>Create account</h3><form onSubmit={create} className="manage-form">
      <label>Name<input className="input" required maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label>
      <label>Email {role === 'LAB_ASSISTANT' && <small>(optional for WhatsApp-only accounts)</small>}<input className="input" type="email" required={role === 'SUB_ADMIN'} value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Employee ID<input className="input" required maxLength={30} value={employeeId} onChange={e => setEmployeeId(e.target.value)} /></label>
      <label>Role<select className="select" value={role} onChange={e => { setRole(e.target.value as typeof role); setScopeId(''); }}><option value="LAB_ASSISTANT">Lab Assistant</option><option value="SUB_ADMIN">Sub-Admin</option></select></label>
      {role === 'LAB_ASSISTANT' && <label>Mobile number for WhatsApp<input className="input" type="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 90000 00000" /></label>}
      <label>{role === 'LAB_ASSISTANT' ? 'Allowed location' : 'Assigned scope'}<select className="select" required={role === 'LAB_ASSISTANT'} value={scopeId} onChange={e => { setScopeId(e.target.value); setDefaultLocationId(''); }}><option value="">{role === 'LAB_ASSISTANT' ? 'Select location…' : 'Any location'}</option>{selectable.map(l => <option key={l.id} value={l.id}>{l.name} · {l.type}</option>)}</select></label>
      {role === 'LAB_ASSISTANT' && <label>Default lab / room<select className="select" value={defaultLocationId} onChange={e => setDefaultLocationId(e.target.value)}><option value="">None</option>{defaultOptions.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>}
      {role === 'SUB_ADMIN' && <label><input type="checkbox" checked={canEscalate} onChange={e => setCanEscalate(e.target.checked)} /> Can request Main Admin escalation</label>}
      <label>Initial portal password <small>(optional for WhatsApp-only accounts)</small><input className="input" type="password" minLength={10} value={password} onChange={e => setPassword(e.target.value)} /></label>
      <button className="btn btn-primary" disabled={busy}>Create account</button>
    </form></section><section className="panel glass manage-panel"><h3>Accounts</h3><div className="manage-table-wrap"><table className="manage-table"><thead><tr><th>Name</th><th>Role</th><th>Employee ID</th><th>Mobile</th><th>Scope</th><th>Status</th><th>Action</th></tr></thead><tbody>{users.map(u => <tr key={u.id}><td>{u.name}<br /><small>{u.email}</small></td><td>{u.role.replace(/_/g, ' ')}</td><td>{u.employeeId}</td><td>{u.phone || '—'}</td><td>{[...(u.allowedLocationIds || []), ...(u.scopeLocationIds || [])].map(id => locations.find(l => l.id === id)?.name || id).join(', ') || 'All'}</td><td>{u.status}</td><td>{u.role !== 'MAIN_ADMIN' && <button className="btn btn-ghost" disabled={busy} onClick={() => void patch(u.id, { status: u.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED' }, 'Account status updated.')}>{u.status === 'DISABLED' ? 'Activate' : 'Deactivate'}</button>}</td></tr>)}</tbody></table></div>
      <form onSubmit={setAccountPassword} className="manage-form" style={{ marginTop: 24 }}><h3>Activate or reset portal password</h3><label>Account<select className="select" required value={selected} onChange={e => setSelected(e.target.value)}><option value="">Select account…</option>{users.filter(u => u.role !== 'MAIN_ADMIN').map(u => <option key={u.id} value={u.id}>{u.name} · {u.status}</option>)}</select></label><label>New password<input className="input" type="password" required minLength={10} value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label><button className="btn btn-primary" disabled={busy}>Set password and activate</button></form>
      <form onSubmit={saveProfile} className="manage-form" style={{ marginTop: 24 }}><h3>Edit account</h3><label>Account<select className="select" required value={editId} onChange={e => selectForEdit(e.target.value)}><option value="">Select account…</option>{users.filter(u => u.role !== 'MAIN_ADMIN').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>{editId && <><label>Name<input className="input" required value={editName} onChange={e => setEditName(e.target.value)} /></label>{users.find(u => u.id === editId)?.role === 'LAB_ASSISTANT' && <label>Mobile number<input className="input" required value={editPhone} onChange={e => setEditPhone(e.target.value)} /></label>}<label>Assigned location<select className="select" required={users.find(u => u.id === editId)?.role === 'LAB_ASSISTANT'} value={editScope} onChange={e => setEditScope(e.target.value)}><option value="">Select location…</option>{selectable.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>{users.find(u => u.id === editId)?.role === 'LAB_ASSISTANT' && <label>Default lab / room<select className="select" value={editDefault} onChange={e => setEditDefault(e.target.value)}><option value="">None</option>{locations.filter(l => l.type === 'LAB').map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>}{users.find(u => u.id === editId)?.role === 'SUB_ADMIN' && <label><input type="checkbox" checked={editEscalate} onChange={e => setEditEscalate(e.target.checked)} /> Can request escalation</label>}<button className="btn btn-primary" disabled={busy}>Save account</button></>}</form>
    </section></div>
  </div>;
}
