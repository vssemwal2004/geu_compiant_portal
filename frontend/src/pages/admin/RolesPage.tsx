import { useEffect, useState } from 'react';
import { api } from '../../api';
import './Management.css';
type RoleInfo = { role: string; label: string; permissions: string[] };
export default function RolesPage() {
  const [roles, setRoles] = useState<RoleInfo[]>([]); const [error, setError] = useState('');
  useEffect(() => { void api<RoleInfo[]>('/admin/roles').then(setRoles).catch(e => setError(e.message)); }, []);
  return <div className="dash"><div className="page-head"><div><h2>Roles &amp; Permissions</h2><p>Fixed permissions enforced on every API request.</p></div></div>{error && <p className="manage-error" role="alert">{error}</p>}<div className="manage-grid">{roles.map(role => <section className="panel glass manage-panel" key={role.role}><h3>{role.label}</h3><p className="manage-note">{role.role.replace(/_/g, ' ')}</p><div className="manage-pills" style={{ marginTop: 18 }}>{role.permissions.map(permission => <span key={permission} className="manage-pill">{permission}</span>)}</div></section>)}</div></div>;
}
