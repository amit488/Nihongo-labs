'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import styles from './auth.module.css';
import {
  resendSignupConfirmationAction,
  signInAction,
  signUpAction,
} from '@/app/actions/auth';

export default function AuthForm({
  mode,
  confirmationError = false,
}: {
  mode: 'login' | 'signup';
  confirmationError?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    confirmationError
      ? 'That confirmation link could not be verified. It may have expired or already been used. Request a fresh link below.'
      : '',
  );
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [resending, setResending] = useState(false);
  const signup = mode === 'signup';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setBusy(true);

    try {
      const formData = new FormData(event.currentTarget);
      if (signup) formData.set('displayName', name);

      const result = signup ? await signUpAction(formData) : await signInAction(formData);
      if (result.confirmationRequired) {
        setConfirmationEmail(result.email || email.trim());
        setConfirmationMessage(result.message);
        setShowConfirmation(true);
        return;
      }

      setMessage(result.message);
      if (result.success && result.authenticated) router.push('/learn');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    if (!confirmationEmail || resending) return;
    setResending(true);
    setConfirmationMessage('');

    try {
      const result = await resendSignupConfirmationAction(confirmationEmail);
      setConfirmationMessage(result.message);
    } catch (error) {
      setConfirmationMessage(
        error instanceof Error ? error.message : 'We could not resend the confirmation email. Please try again.',
      );
    } finally {
      setResending(false);
    }
  }

  function useDifferentEmail() {
    setShowConfirmation(false);
    setConfirmationMessage('');
    setMessage('');
  }

  return (
    <div className={styles.authPage}>
      <div className={styles.authVisual}>
        <Link href="/learn" className={styles.brand}>
          <span className={styles.brandMark}>日</span>
          <span><strong>nihongo<span>.</span></strong><small>LABS · JLPT LEARNING</small></span>
        </Link>
        <div className={styles.visualCopy}>
          <div className={styles.visualEyebrow}>YOUR JAPANESE JOURNEY STARTS HERE</div>
          <div className={styles.visualKanji}>学</div>
          <h1>One new word.<br /><em>A whole new world.</em></h1>
          <p>Learn Japanese with a little structure, a little curiosity and a little practice each day.</p>
        </div>
        <div className={styles.visualFooter}>学ぶ · Practice makes progress <span>✳</span></div>
      </div>

      <div className={styles.authPanel}>
        <div className={styles.authMobileBrand}>
          <span className={styles.brandMark}>日</span>
          <strong>nihongo<span>.</span></strong>
        </div>

        <div className={styles.authCard}>
          {showConfirmation ? (
            <section className={styles.confirmationPanel} aria-live="polite">
              <div className={styles.confirmationIcon} aria-hidden="true">✉</div>
              <div className={styles.authEyebrow}>ONE LAST STEP</div>
              <h2>Check your inbox.</h2>
              <p>We sent a confirmation link to the email address below. Open it in this browser to verify your address and finish creating your Nihongo Labs account.</p>
              <div className={styles.confirmationEmail}>{confirmationEmail}</div>
              <p className={styles.confirmationHint}>The link may take a minute to arrive. Check your spam or promotions folder too. For security, confirmation links expire and can only be used once.</p>
              <button
                type="button"
                className={styles.confirmationPrimary}
                onClick={() => void resendConfirmation()}
                disabled={resending}
              >
                {resending ? 'Sending…' : 'Resend confirmation email'}
                <span>↗</span>
              </button>
              {confirmationMessage ? (
                <div className={styles.confirmationFeedback} role="status">{confirmationMessage}</div>
              ) : null}
              <button type="button" className={styles.confirmationSecondary} onClick={useDifferentEmail}>
                Use a different email address
              </button>
              <div className={styles.authSwitch}>
                Already confirmed? <Link href="/login">Sign in</Link>
              </div>
            </section>
          ) : (
            <>
              <div className={styles.authEyebrow}>{signup ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'}</div>
              <h2>{signup ? 'Start your learning journey.' : 'Good to see you again.'}</h2>
              <p>{signup ? 'Your first step towards confident Japanese starts here.' : 'Pick up where you left off and keep your streak going.'}</p>

              <form onSubmit={submit}>
                {signup ? (
                  <label>
                    Full name
                    <input
                      name="displayName"
                      autoComplete="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="What should we call you?"
                      required
                      maxLength={80}
                    />
                  </label>
                ) : null}
                <label>
                  Email address
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </label>
                {signup && confirmationError ? (
                  <button
                    type="button"
                    className={styles.inlineResend}
                    disabled={!email.trim()}
                    onClick={() => {
                      setConfirmationEmail(email.trim());
                      setShowConfirmation(true);
                      setConfirmationMessage('');
                    }}
                  >
                    Resend a fresh confirmation link
                  </button>
                ) : null}
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    autoComplete={signup ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={signup ? 'At least 8 characters' : 'Enter your password'}
                    minLength={8}
                    maxLength={128}
                    required
                  />
                </label>
                <button type="submit" disabled={busy}>
                  {busy
                    ? (signup ? 'Creating account…' : 'Signing in…')
                    : (signup ? 'Create your free account' : 'Sign in')}
                  <span>→</span>
                </button>
              </form>

              {message ? <div className={styles.authMessage} role="alert">{message}</div> : null}
              <div className={styles.authSwitch}>
                {signup ? 'Already have an account?' : 'New to Nihongo Labs?'}
                {' '}
                <Link href={signup ? '/login' : '/signup'}>{signup ? 'Sign in' : 'Create an account'}</Link>
              </div>
              <div className={styles.authLegal}>
                By continuing, you agree to our <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
