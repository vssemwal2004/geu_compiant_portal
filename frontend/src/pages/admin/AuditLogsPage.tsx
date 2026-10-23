import { useEffect, useState } from 'react';
import { api } from '../../api';
import { userName } from '../../domain/format';
import { formatDate } from '../../domain/format';
import './Management.css';
type Log = { id: string; at: string; actorId?: string; action: string; targetType: string; targetId: string };
export default function AuditLogsPage() {
  const [logs, setLogs] = useState<Log[]>([]); const [error, setError] = useState('');
  useEffect(() => { void api<Log[]>('/admin/audit-logs').then(setLogs).catch(e => setError(e.message)); }, []);
  return <div className="dash"><div className="page-head"><div><h2>Audit Logs</h2><p>Recent account, configuration and ticket actions.</p></div></div>{error && <p role="alert" className="manage-error">{error}</p>}<section className="panel glass manage-panel"><div className="manage-table-wrap"><table className="manage-table"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th></tr></thead><tbody>{logs.map(log => <tr key={log.id}><td>{formatDate(log.at)}</td><td>{userName(log.actorId)}</td><td>{log.action.replace(/_/g, ' ')}</td><td>{log.targetType} · {log.targetId}</td></tr>)}</tbody></table></div>{!logs.length && <p className="manage-note">No actions recorded yet.</p>}</section></div>;
}
