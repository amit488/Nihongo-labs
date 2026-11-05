'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import styles from './auth.module.css';
import { signInAction, signUpAction } from '@/app/actions/auth';

export default function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const signup=mode==='signup';

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setMessage('');setBusy(true);
    try {
      const formData = new FormData(event.currentTarget);
      if (signup) formData.set('displayName', name);
      const result = signup ? await signUpAction(formData) : await signInAction(formData);
      setMessage(result.message);
      if (result.success && result.authenticated) router.push('/learn');
    } catch(error) {
      setMessage(error instanceof Error?error.message:'Something went wrong. Please try again.');
    } finally { setBusy(false); }
  }

  return <div className={styles.authPage}>
    <div className={styles.authVisual}><Link href="/learn" className={styles.brand}><span className={styles.brandMark}>日</span><span><strong>nihongo<span>.</span></strong><small>LABS · JLPT LEARNING</small></span></Link><div className={styles.visualCopy}><div className={styles.visualEyebrow}>YOUR JAPANESE JOURNEY STARTS HERE</div><div className={styles.visualKanji}>学</div><h1>One new word.<br/><em>A whole new world.</em></h1><p>Learn Japanese with a little structure, a little curiosity and a little practice each day.</p></div><div className={styles.visualFooter}>学ぶ · Practice makes progress <span>✳</span></div></div>
    <div className={styles.authPanel}><div className={styles.authMobileBrand}><span className={styles.brandMark}>日</span><strong>nihongo<span>.</span></strong></div><div className={styles.authCard}><div className={styles.authEyebrow}>{signup?'CREATE YOUR ACCOUNT':'WELCOME BACK'}</div><h2>{signup?'Start your learning journey.':'Good to see you again.'}</h2><p>{signup?'Your first step towards confident Japanese starts here.':'Pick up where you left off and keep your streak going.'}</p><form onSubmit={submit}>
      {signup&&<label>Full name<input name="displayName" autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="What should we call you?" required maxLength={80}/></label>}
      <label>Email address<input name="email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required/></label>
      <label>Password<input name="password" type="password" autoComplete={signup?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={signup?'At least 8 characters':'Enter your password'} minLength={8} required/></label>
      <button type="submit" disabled={busy}>{busy?(signup?'Creating account...':'Signing in...'):(signup?'Create your free account':'Sign in')} <span>→</span></button>
    </form>{message&&<div className={styles.authMessage}>{message}</div>}<div className={styles.authSwitch}>{signup?'Already have an account?':'New to Nihongo Labs?'} <Link href={signup?'/login':'/signup'}>{signup?'Sign in':'Create an account'}</Link></div><div className={styles.authLegal}>By continuing, you agree to our <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.</div></div></div>
  </div>;
}
