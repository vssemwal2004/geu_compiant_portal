import { useState, type CSSProperties, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Phone, TriangleAlert, User } from 'lucide-react';
import logo from '../assets/geu-logo.png';
import HelpDeskScene from '../components/login/HelpDeskScene';
import { roleHome, useSession } from '../state/session';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, signIn, requestOtp, verifyOtp } = useSession();
  const [mode, setMode] = useState<'email' | 'mobile'>('mobile');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (user && !busy) return <Navigate to={user.passwordChangeRequired ? '/change-password' : roleHome[user.role]} replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(''); setMessage(''); setBusy(true);
    try {
      if (mode === 'email') {
        if (!email.trim() || !password) throw new Error('Enter your email and password.');
        const signedIn = await signIn(email.trim(), password);
        navigate(signedIn.passwordChangeRequired ? '/change-password' : roleHome[signedIn.role], { replace: true });
      } else if (!codeSent) {
        if (!phone.trim()) throw new Error('Enter your mobile number.');
        await requestOtp(phone.trim());
        setCodeSent(true);
        setMessage('If this mobile number is registered, a six-digit code has been sent by SMS. It expires in five minutes.');
      } else {
        if (!/^\d{6}$/.test(code)) throw new Error('Enter the six-digit code.');
        const signedIn = await verifyOtp(phone.trim(), code);
        navigate(roleHome[signedIn.role], { replace: true });
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign-in failed.'); }
    finally { setBusy(false); }
  }

  async function resend() {
    setError(''); setMessage(''); setBusy(true);
    try { await requestOtp(phone.trim()); setMessage('If eligible, a new code has been sent. Please wait one minute between requests.'); setCode(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not send a new code.'); }
    finally { setBusy(false); }
  }

  return <div className="login">
    <section className="login-brand" aria-label="About the portal">
      <div className="login-brand__bg" aria-hidden="true" />
      <header className="login-brand__top rise-in"><img src={logo} alt="Graphic Era deemed to be University, Dehradun" className="login-brand__logo" /></header>
      <div className="login-brand__intro rise-in" style={{ '--i': 1 } as CSSProperties}>
        <span className="login-brand__eyebrow"><span className="live-dot" aria-hidden="true" /> Complaint &amp; Asset Ticket Portal</span>
        <h1 className="login-brand__title">Report it. Route it. <span>Resolve it.</span></h1>
        <p className="login-brand__lead">The campus service desk for labs, classrooms and hostels — every issue reaches the right team and is tracked until it is fixed.</p>
      </div>
      <div className="login-brand__scene rise-in" style={{ '--i': 2 } as CSSProperties}><HelpDeskScene /></div>
    </section>
    <main className="login-main">
      <div className="login-card rise-in" style={{ '--i': 2 } as CSSProperties}>
        <div className="login-card__head"><span className="login-card__badge"><Lock size={14} aria-hidden="true" /> Secure sign-in</span><h2>Welcome back</h2><p>Use your registered mobile number or your university email.</p></div>
        <div className="login-modes" role="tablist" aria-label="Sign-in method">
          <button type="button" role="tab" aria-selected={mode === 'mobile'} className={mode === 'mobile' ? 'active' : ''} onClick={() => { setMode('mobile'); setError(''); setMessage(''); }}>Mobile OTP</button>
          <button type="button" role="tab" aria-selected={mode === 'email'} className={mode === 'email' ? 'active' : ''} onClick={() => { setMode('email'); setError(''); setMessage(''); }}>Email &amp; password</button>
        </div>
        {error && <div className="login-alert" role="alert"><TriangleAlert size={18} />{error}</div>}
        {message && <p className="login-message" role="status">{message}</p>}
        <form onSubmit={submit}>
          {mode === 'mobile' ? <>
            <div className="field"><label htmlFor="mobile">Mobile number</label><div className="field__control"><Phone size={18} className="field__icon" aria-hidden="true" /><input id="mobile" type="tel" autoComplete="tel" placeholder="+91 90000 00000" value={phone} disabled={codeSent} onChange={e => setPhone(e.target.value)} required /></div></div>
            {codeSent && <><div className="field"><label htmlFor="code">Six-digit SMS code</label><div className="field__control"><Lock size={18} className="field__icon" aria-hidden="true" /><input id="code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" placeholder="Enter code" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} required /></div></div><div className="login-actions"><button type="button" onClick={() => { setCodeSent(false); setCode(''); setMessage(''); }}>Change number</button><button type="button" disabled={busy} onClick={() => void resend()}>Resend code</button></div></>}
          </> : <>
            <div className="field"><label htmlFor="email">Email address</label><div className="field__control"><User size={18} className="field__icon" aria-hidden="true" /><input id="email" type="email" autoComplete="username" placeholder="name@geu.ac.in" value={email} onChange={e => setEmail(e.target.value)} required /></div></div>
            <div className="field"><div className="field__label-row"><label htmlFor="password">Password</label><span className="field__link">For password help, contact the portal administrator.</span></div><div className="field__control"><Lock size={18} className="field__icon" aria-hidden="true" /><input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required /><button type="button" className="field__toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
          </>}
          <button type="submit" className="btn btn-primary login-submit" disabled={busy}>{busy ? <><Loader2 size={18} className="spin" /> Please wait…</> : <>{mode === 'mobile' ? codeSent ? 'Verify and sign in' : 'Send SMS code' : 'Sign in'} <ArrowRight size={18} /></>}</button>
        </form>
      </div>
      <p className="login-copy">© {new Date().getFullYear()} Graphic Era (Deemed to be University), Dehradun</p>
    </main>
  </div>;
}
