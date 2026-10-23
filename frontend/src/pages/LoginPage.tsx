import { useState, type CSSProperties, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, TriangleAlert, User } from 'lucide-react';
import logo from '../assets/geu-logo.png';
import HelpDeskScene from '../components/login/HelpDeskScene';
import { roleHome, useSession } from '../state/session';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, signIn } = useSession();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ identifier?: string; password?: string; form?: string }>({});

  if (user && !submitting) return <Navigate to={roleHome[user.role]} replace />;

  async function attempt(id: string, pass: string) {
    const next: typeof errors = {};
    if (!id.trim()) next.identifier = 'Enter your university email or employee ID.';
    if (!pass) next.password = 'Enter your password.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      const signedIn = await signIn(id, pass);
      navigate(roleHome[signedIn.role], { replace: true });
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : 'Sign-in failed.' });
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    attempt(identifier, password);
  }

  return (
    <div className="login">
      <section className="login-brand" aria-label="About the portal">
        <div className="login-brand__bg" aria-hidden="true" />

        <header className="login-brand__top rise-in">
          <img src={logo} alt="Graphic Era deemed to be University, Dehradun" className="login-brand__logo" />
        </header>

        <div className="login-brand__intro rise-in" style={{ '--i': 1 } as CSSProperties}>
          <span className="login-brand__eyebrow">
            <span className="live-dot" aria-hidden="true" />
            Complaint &amp; Asset Ticket Portal
          </span>
          <h1 className="login-brand__title">
            Report it. Route it. <span>Resolve it.</span>
          </h1>
          <p className="login-brand__lead">
            The campus service desk for labs, classrooms and hostels — every issue reaches the right
            team and is tracked until it is fixed.
          </p>
        </div>

        <div className="login-brand__scene rise-in" style={{ '--i': 2 } as CSSProperties}>
          <HelpDeskScene />
        </div>
      </section>

      <main className="login-main">
        <div className="login-card rise-in" style={{ '--i': 2 } as CSSProperties}>
          <div className="login-card__head">
            <span className="login-card__badge">
              <Lock size={14} aria-hidden="true" /> Secure sign-in
            </span>
            <h2>Welcome back</h2>
            <p>Sign in with the credentials issued by the portal administrator.</p>
          </div>

          {errors.form && (
            <div className="login-alert" role="alert">
              <TriangleAlert size={18} />
              {errors.form}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className={`field ${errors.identifier ? 'field--error' : ''}`}>
              <label htmlFor="identifier">Email or Employee ID</label>
              <div className="field__control">
                <User size={18} className="field__icon" aria-hidden="true" />
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="name@geu.ac.in"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  aria-invalid={!!errors.identifier}
                  aria-describedby={errors.identifier ? 'identifier-error' : undefined}
                />
              </div>
              {errors.identifier && (
                <p id="identifier-error" className="field__error">
                  {errors.identifier}
                </p>
              )}
            </div>

            <div className={`field ${errors.password ? 'field--error' : ''}`}>
              <div className="field__label-row">
                <label htmlFor="password">Password</label>
                <span className="field__link">For password help, contact the portal administrator.</span>
              </div>
              <div className="field__control">
                <Lock size={18} className="field__icon" aria-hidden="true" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                />
                <button
                  type="button"
                  className="field__toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="field__error">
                  {errors.password}
                </p>
              )}
            </div>

            <label className="check">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span className="check__box" aria-hidden="true" />
              Keep me signed in on this device
            </label>

            <button type="submit" className="btn btn-primary login-submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 size={18} className="spin" /> Signing in…
                </>
              ) : (
                <>
                  Sign in <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="login-copy">© {new Date().getFullYear()} Graphic Era (Deemed to be University), Dehradun</p>
      </main>
    </div>
  );
}
