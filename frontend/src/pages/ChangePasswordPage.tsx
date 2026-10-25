import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { roleHome, useSession } from '../state/session';
import './LoginPage.css';

export default function ChangePasswordPage() {
  const { user, changePassword, signOut } = useSession();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!user) return <Navigate to="/login" replace />;
  if (!user.passwordChangeRequired) return <Navigate to={roleHome[user.role]} replace />;
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (next.length < 10) return setError('Use at least 10 characters for your new password.');
    if (next !== confirm) return setError('New passwords do not match.');
    setBusy(true);
    try { const updated = await changePassword(current, next); navigate(roleHome[updated.role], { replace: true }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not change password.'); }
    finally { setBusy(false); }
  }
  return <main className="password-setup"><section className="login-card"><div className="login-card__head"><h1>Set your new password</h1><p>Change the initial password before using the portal.</p></div>{error && <div className="login-alert" role="alert">{error}</div>}<form onSubmit={submit}><div className="field"><label htmlFor="current">Initial password</label><div className="field__control"><input id="current" type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} required /></div></div><div className="field"><label htmlFor="next">New password</label><div className="field__control"><input id="next" type="password" autoComplete="new-password" minLength={10} value={next} onChange={e => setNext(e.target.value)} required /></div></div><div className="field"><label htmlFor="confirm">Confirm new password</label><div className="field__control"><input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required /></div></div><button className="btn btn-primary login-submit" disabled={busy}>{busy ? 'Saving…' : 'Save password and continue'}</button></form><button className="password-setup__signout" type="button" onClick={() => { signOut(); navigate('/login', { replace: true }); }}>Sign out</button></section></main>;
}
