import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { formatDate, userName } from '../../domain/format';
import './Management.css';
type Escalation = { id: string; at: string; actorId: string; ticketCode: string; text: string; status: string };
export default function EscalationsPage() {
  const [items, setItems] = useState<Escalation[]>([]); const [error, setError] = useState('');
  useEffect(() => { void api<Escalation[]>('/admin/escalations').then(setItems).catch(e => setError(e.message)); }, []);
  return <div className="dash"><div className="page-head"><div><h2>Escalations</h2><p>Resolver requests needing Main Admin attention.</p></div></div>{error && <p role="alert" className="manage-error">{error}</p>}<section className="panel glass manage-panel"><div className="manage-table-wrap"><table className="manage-table"><thead><tr><th>When</th><th>Ticket</th><th>Requested by</th><th>Reason</th><th>Status</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td>{formatDate(item.at)}</td><td><Link to={`/admin/tickets/${item.ticketCode}`}>{item.ticketCode}</Link></td><td>{userName(item.actorId)}</td><td>{item.text}</td><td>{item.status}</td></tr>)}</tbody></table></div>{!items.length && <p className="manage-note">No escalations yet.</p>}</section></div>;
}
