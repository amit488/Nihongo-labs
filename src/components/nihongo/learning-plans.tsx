"use client";

import { useState } from 'react';
import styles from './learning-plans.module.css';
import { pricingPlans } from '@/lib/nihongo/pricing-plans';

type PlanCode = 'monthly' | 'half_year' | 'annual';


type CheckoutBody = {
  mode?: string;
  checkoutUrl?: string;
  error?: string;
};

export default function LearningPlans({ signedIn }: { signedIn: boolean }) {
  const [busyPlan, setBusyPlan] = useState<PlanCode | null>(null);
  const [notice, setNotice] = useState('');

  async function choosePlan(code: PlanCode) {
    if (!signedIn) return;
    setBusyPlan(code);
    setNotice('');
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode: code, idempotencyKey: crypto.randomUUID() }),
      });
      const body = await response.json() as CheckoutBody;
      if (!response.ok) throw new Error(body.error || 'Checkout could not be started.');
      if (body.mode !== 'subscription' || !body.checkoutUrl) {
        throw new Error('The selected plan is not configured for recurring checkout yet.');
      }
      window.location.assign(body.checkoutUrl);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not start checkout. Please try again.');
      setBusyPlan(null);
    }
  }

  return (
    <section className={styles.page}>
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>YOUR LEARNING, YOUR PACE</span>
          <h1>Choose your learning plan.</h1>
          <p>Three simple ways to keep your Japanese learning moving forward.</p>
        </div>
      </header>

      {!signedIn ? (
        <div className={styles.signInNotice}>
          <p>Sign in to choose a learning plan for your account.</p>
          <Link href="/login">Sign in <span>→</span></Link>
        </div>
      ) : null}

      {notice ? <p className={styles.notice} role="alert">{notice}</p> : null}

      <div className={styles.cards}>
        {pricingPlans.map((plan) => (
          <article key={plan.code} className={plan.featured ? `${styles.card} ${styles.featured}` : styles.card}>
            {plan.featured ? <span className={styles.recommended}>BEST VALUE</span> : null}
            <span className={styles.planLabel}>{plan.label}</span>
            <h2>{plan.name}</h2>
            <div className={styles.price}>
              <strong>{plan.price}</strong>
              <span>{plan.period}</span>
            </div>
            <div className={styles.monthly}>
              <span>Works out to</span>
              <strong>{plan.monthly} / month</strong>
            </div>
            <p className={styles.billing}>{plan.billing}</p>
            <p className={styles.saving}>{plan.note}</p>
            <button
              type="button"
              disabled={!signedIn || busyPlan !== null}
              onClick={() => void choosePlan(plan.code)}
              className={plan.featured ? styles.primaryButton : styles.secondaryButton}
            >
              {busyPlan === plan.code ? 'Starting checkout…' : 'Choose this plan'}
              <span>→</span>
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
