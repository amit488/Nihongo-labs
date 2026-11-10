'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import styles from './auth.module.css';
import Brand from './brand';
import { resendSignupConfirmationAction, signInAction, signUpAction } from '@/app/actions/auth';

export default function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');
  const [verificationPending, setVerificationPending] = useState(false);
  const [accountAlreadyExists, setAccountAlreadyExists] = useState(false);
  const signup = mode === 'signup';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setBusy(true);
    try {
      const formData = new FormData(event.currentTarget);
      if (signup) formData.set('displayName', name);
      const result = signup ? await signUpAction(formData) : await signInAction(formData);
      setMessage(result.message);
      setVerificationPending(result.success && result.requiresEmailConfirmation === true);
      setAccountAlreadyExists(result.alreadyRegistered === true);
      if (result.success && result.authenticated) router.push(result.redirectTo ?? '/learn');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    setMessage('');
    setResending(true);
    try {
      const formData = new FormData();
      formData.set('email', email);
      const result = await resendSignupConfirmationAction(formData);
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'We could not resend the email. Please try again.');
    } finally {
      setResending(false);
    }
  }

  return <div className={styles.authPage}>
    <div className={styles.authVisual}>
      <Brand href="/learn" className={styles.brand} />
      <div className={styles.visualCopy}>
        <div className={styles.visualEyebrow}>YOUR JAPANESE JOURNEY STARTS HERE</div>
        <div className={styles.visualKanji}>学</div>
        <h1>One new word.<br/><em>A whole new world.</em></h1>
        <p>Learn Japanese with a little structure, a little curiosity and a little practice each day.</p>
      </div>
      <div className={styles.visualFooter}>学ぶ · Practice makes progress <span>✳</span></div>
    </div>
    <div className={styles.authPanel}>
      <Brand href="/learn" className={styles.authMobileBrand} />
      <div className={styles.authCard}>
        {verificationPending ? (
          <section className={styles.verificationPanel} aria-live="polite">
            <div className={styles.verificationIcon}>✉</div>
            <div className={styles.authEyebrow}>ONE LAST STEP</div>
            <h2>Check your inbox.</h2>
            <p>We sent a verification link to <strong>{email}</strong>. Open the email and confirm your address to unlock your Nihongo Labs learning space.</p>
            <div className={styles.verificationTip}><span>日</span><div><strong>Look for “Confirm your Nihongo Labs account”</strong><small>Can’t see it? Check your spam or promotions folder.</small></div></div>
            {message && <div className={styles.authMessage} role="status">{message}</div>}
            <button className={styles.resendButton} type="button" onClick={resendConfirmation} disabled={resending}>
              {resending ? 'Sending...' : 'Resend verification email'} <span>↗</span>
            </button>
            <button className={styles.backToSignup} type="button" onClick={() => { setVerificationPending(false); setMessage(''); }}>
              ← Back to sign-up
            </button>
          </section>
        ) : (
          <>
            <div className={styles.authEyebrow}>{signup ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'}</div>
            <h2>{signup ? 'Start your learning journey.' : 'Good to see you again.'}</h2>
            <p>{signup ? 'Your first step towards confident Japanese starts here.' : 'Pick up where you left off and keep your streak going.'}</p>
            <form onSubmit={submit}>
              {signup && <label>Full name<input name="displayName" autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="What should we call you?" required maxLength={80}/></label>}
              <label>Email address<input name="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required maxLength={254}/></label>
              <label>Password<input name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={signup ? 'At least 8 characters' : 'Enter your password'} minLength={8} required/></label>
              <button type="submit" disabled={busy}>{busy ? (signup ? 'Creating account...' : 'Signing in...') : (signup ? 'Create your free account' : 'Sign in')} <span>→</span></button>
            </form>
            {message && <div className={styles.authMessage} role="alert">{message}{accountAlreadyExists && <> <Link href="/login">Go to sign in →</Link></>}</div>}
            <div className={styles.authSwitch}>{signup ? 'Already have an account?' : 'New to Nihongo Labs?'} <Link href={signup ? '/login' : '/signup'}>{signup ? 'Sign in' : 'Create an account'}</Link></div>
            <div className={styles.authLegal}>By continuing, you agree to our <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.</div>
          </>
        )}
      </div>
    </div>
  </div>;
}
