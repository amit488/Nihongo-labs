'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import Brand from '@/components/nihongo/brand';
import { getSupabaseBrowserClient } from '@/lib/nihongo/supabase';
import styles from './contact-page.module.css';

type SubmitState = 'idle' | 'sending' | 'success' | 'error';

const messageTypes = ['Suggestion', 'Complaint', 'Bug report', 'Other'] as const;

export default function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState<(typeof messageTypes)[number]>('Suggestion');
  const [message, setMessage] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;
    const client = getSupabaseBrowserClient();
    if (!client) return;
    void client.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return;
      const metadata = data.user.user_metadata ?? {};
      const suggestedName = metadata.full_name || metadata.name || '';
      setName((current) => current || String(suggestedName));
      setEmail((current) => current || data.user.email || '');
    }).catch(() => {
      // The form remains available to signed-out visitors if profile prefill fails.
    });
    return () => { active = false; };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitState === 'sending') return;
    setSubmitState('sending');
    setErrorMessage('');

    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          subject,
          message,
          website: String(formData.get('website') || ''),
        }),
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || 'We could not send your message. Please try again.');
      setSubmitState('success');
      setMessage('');
    } catch (error) {
      setSubmitState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.nav}>
        <Brand href="/" />
        <Link href="/learn" className={styles.workspaceLink}>Back to workspace <span aria-hidden="true">↗</span></Link>
      </header>

      <section className={styles.main}>
        <div className={styles.intro}>
          <span className={styles.eyebrow}><i /> WE’RE LISTENING</span>
          <h1>Help us make<br /><em>Nihongo Labs</em> better.</h1>
          <p className={styles.lead}>Have an idea, spotted something that is not working, or want to raise a concern? Send it our way. Every message helps us improve the learning experience.</p>
          <div className={styles.promise}>
            <span className={styles.promiseIcon} aria-hidden="true">✳</span>
            <div><strong>Real feedback. Thoughtful improvements.</strong><p>Suggestions and complaints go to our team for review. We use your email only if we need to follow up.</p></div>
          </div>
          <p className={styles.privacy}>Please do not include passwords, payment-card details or other sensitive information.</p>
        </div>

        <div className={styles.formCard}>
          {submitState === 'success' ? (
            <div className={styles.success} role="status">
              <div className={styles.successMark} aria-hidden="true">✓</div>
              <span className={styles.eyebrow}>MESSAGE RECEIVED</span>
              <h2>Thank you for speaking up.</h2>
              <p>Your message has been sent to the Nihongo Labs team. We appreciate you taking the time to help us improve.</p>
              <button type="button" className={styles.secondaryButton} onClick={() => setSubmitState('idle')}>Send another message</button>
              <Link href="/learn" className={styles.backLink}>Return to your workspace →</Link>
            </div>
          ) : (
            <>
              <div className={styles.formHeading}>
                <span className={styles.formStep}>YOUR VOICE MATTERS</span>
                <h2>Send us a message</h2>
                <p>Tell us a little about what is on your mind.</p>
              </div>
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.field}>
                  <label htmlFor="contact-name">Your name</label>
                  <input id="contact-name" name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required placeholder="How should we address you?" />
                </div>
                <div className={styles.field}>
                  <label htmlFor="contact-email">Email address</label>
                  <input id="contact-email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required placeholder="you@example.com" />
                  <small>We’ll use this only to respond to your message if needed.</small>
                </div>
                <div className={styles.field}>
                  <label htmlFor="contact-subject">What would you like to share?</label>
                  <select id="contact-subject" name="subject" value={subject} onChange={(event) => setSubject(event.target.value as (typeof messageTypes)[number])}>
                    {messageTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <div className={styles.messageLabel}><label htmlFor="contact-message">Your message</label><span>{message.length}/10,000</span></div>
                  <textarea id="contact-message" name="message" value={message} onChange={(event) => setMessage(event.target.value)} minLength={5} maxLength={10000} required rows={7} placeholder="Share your suggestion, describe the issue, or tell us what could be better…" />
                </div>

                <div className={styles.honeypot} aria-hidden="true">
                  <label htmlFor="contact-website">Leave this field empty</label>
                  <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
                </div>

                {submitState === 'error' ? <p className={styles.error} role="alert">{errorMessage}</p> : null}
                <button type="submit" className={styles.submitButton} disabled={submitState === 'sending'}>
                  {submitState === 'sending' ? 'Sending…' : 'Send message'} <span aria-hidden="true">↗</span>
                </button>
                <p className={styles.formFootnote}>By sending this message, you agree that our team may use these details to review and respond to your feedback.</p>
              </form>
            </>
          )}
        </div>
      </section>

      <footer className={styles.footer}>
        <span>Learn with intention. Grow every day.</span>
        <Link href="/">Nihongo Labs home</Link>
      </footer>
    </main>
  );
}
