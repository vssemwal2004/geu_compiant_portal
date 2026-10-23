import { useEffect, useState } from 'react';
import { api } from '../../api';
import { assetTypes, users } from '../../data/referenceData';
import './Management.css';
type Report = { total: number; overdue: number; resolved: number; byStatus: Record<string, number>; byPriority: Record<string, number>; byAssetType: Record<string, number>; byAssignee: Record<string, number> };
export default function ReportsPage() {
  const [report, setReport] = useState<Report | null>(null); const [error, setError] = useState('');
  useEffect(() => { void api<Report>('/admin/reports').then(setReport).catch(e => setError(e.message)); }, []);
  const groups = report ? [
    { title: 'By status', values: report.byStatus, label: (key: string) => key.replace(/_/g, ' ') },
    { title: 'By priority', values: report.byPriority, label: (key: string) => key },
    { title: 'By asset type', values: report.byAssetType, label: (key: string) => assetTypes.find(a => a.id === key)?.name || key },
    { title: 'By assignee', values: report.byAssignee, label: (key: string) => key === 'UNASSIGNED' ? 'Unassigned' : users.find(u => u.id === key)?.name || key },
  ] : [];
  function download() {
    if (!report) return;
    const rows = [['Group', 'Name', 'Count'], ['Summary', 'Total', report.total], ['Summary', 'Resolved', report.resolved], ['Summary', 'Overdue', report.overdue], ...groups.flatMap(group => Object.entries(group.values).map(([key, value]) => [group.title, group.label(key), value]))];
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'geu-ticket-report.csv'; link.click(); URL.revokeObjectURL(url);
  }
  return <div className="dash"><div className="page-head"><div><h2>Reports</h2><p>Live ticket counts across all locations and teams.</p></div><div className="manage-actions"><button className="btn btn-ghost" onClick={() => void api<Report>('/admin/reports').then(setReport).catch(e => setError(e.message))}>Refresh</button><button className="btn btn-primary" disabled={!report} onClick={download}>Download CSV</button></div></div>{error && <p role="alert" className="manage-error">{error}</p>}{report && <><div className="manage-pills"><span className="manage-pill">Total: {report.total}</span><span className="manage-pill">Resolved: {report.resolved}</span><span className="manage-pill">Overdue: {report.overdue}</span></div><div className="manage-grid">{groups.map(group => <section className="panel glass manage-panel" key={group.title}><h3>{group.title}</h3><table className="manage-table"><tbody>{Object.entries(group.values).map(([key, value]) => <tr key={key}><td>{group.label(key)}</td><td>{value}</td></tr>)}</tbody></table>{!Object.keys(group.values).length && <p className="manage-note">No data yet.</p>}</section>)}</div></>}</div>;
}
