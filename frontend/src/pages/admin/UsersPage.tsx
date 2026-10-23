import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../api';
import { locations } from '../../data/referenceData';
import type { Role, User } from '../../domain/types';
import { useSession } from '../../state/session';

type ManagedUser = User & { status: 'ACTIVE' | 'INVITED' | 'DISABLED' };

export default function UsersPage() {
  const { refreshReference } = useSession();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [role, setRole] = useState<Exclude<Role, 'MAIN_ADMIN'>>('LAB_ASSISTANT');
  const [locationId, setLocationId] = useState('');
  const [password, setPassword] = useState('');
  const [selected, setSelected] = useState('');
  const [newPassword, setNewPassword] = useState('');

  async function reload() {
    setUsers(await api<ManagedUser[]>('/admin/users'));
    await refreshReference();
  }
  useEffect(() => { void reload().catch(e => setError(e.message)); }, []);

  async function create(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await api('/admin/users', { method: 'POST', body: JSON.stringify({ name, email, employeeId, role, password, allowedLocationIds: role === 'LAB_ASSISTANT' && locationId ? [locationId] : [] }) });
      await reload();
      setName(''); setEmail(''); setEmployeeId(''); setPassword('');
      setNotice('Account created. Share the password with the user through a secure channel.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create account.'); }
    finally { setBusy(false); }
  }

  async function setAccountPassword(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await api(`/admin/users/${encodeURIComponent(selected)}`, { method: 'PATCH', body: JSON.stringify({ password: newPassword }) });
      await reload();
      setNewPassword(''); setSelected('');
      setNotice('Password set and account activated. Share the password with the user through a secure channel.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update account.'); }
    finally { setBusy(false); }
  }

  return <div className="dash">
    <div className="page-head"><div><h2>Users</h2><p>Create accounts and activate the initial sample accounts.</p></div></div>
    {error && <p role="alert" className="form-error">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <section className="panel glass" style={{ padding: 24 }}>
      <h3>Create account</h3>
      <form onSubmit={create} className="stack" style={{ maxWidth: 520 }}>
        <label>Name<input className="input" required maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Email<input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Employee ID<input className="input" required maxLength={30} value={employeeId} onChange={e => setEmployeeId(e.target.value)} /></label>
        <label>Role<select className="select" value={role} onChange={e => setRole(e.target.value as typeof role)}><option value="LAB_ASSISTANT">Lab Assistant</option><option value="SUB_ADMIN">Sub-Admin</option></select></label>
        {role === 'LAB_ASSISTANT' && <label>Allowed building<select className="select" required value={locationId} onChange={e => setLocationId(e.target.value)}><option value="">Select building…</option>{locations.filter(l => l.type === 'BUILDING').map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>}
        <label>Initial password<input className="input" type="password" required minLength={10} value={password} onChange={e => setPassword(e.target.value)} /></label>
        <button className="btn btn-primary" disabled={busy}>Create account</button>
      </form>
    </section>
    <section className="panel glass" style={{ padding: 24 }}>
      <h3>Existing accounts</h3>
      <div className="stack">{users.map(u => <div key={u.id}>{u.name} · {u.email} · {u.role.replace(/_/g, ' ')} · {u.status}</div>)}</div>
      <form onSubmit={setAccountPassword} className="stack" style={{ maxWidth: 520, marginTop: 24 }}>
        <h4>Activate or reset an account</h4>
        <label>Account<select className="select" required value={selected} onChange={e => setSelected(e.target.value)}><option value="">Select account…</option>{users.filter(u => u.role !== 'MAIN_ADMIN').map(u => <option key={u.id} value={u.id}>{u.name} ({u.status})</option>)}</select></label>
        <label>New password<input className="input" type="password" required minLength={10} value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label>
        <button className="btn btn-primary" disabled={busy}>Set password and activate</button>
      </form>
    </section>
  </div>;
}
