import { connection } from 'next/server';
import Link from 'next/link';
import { createServerSupabase } from '@/lib/nihongo/server/supabase';
import styles from './pricing.module.css';

const plans = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: '₹149',
    period: '/ month',
    monthly: '₹149',
    billing: 'Billed ₹149 every month',
    note: 'Flexible access, month to month.',
    featured: false,
    label: 'STAY FLEXIBLE',
  },
  {
    id: 'half-year',
    name: '6 Months',
    price: '₹809',
    period: '/ 6 months',
    monthly: '₹134.83',
    billing: 'Billed ₹809 once every 6 months',
    note: 'Save ₹85 compared with six monthly payments.',
    featured: false,
    label: 'BUILD YOUR RHYTHM',
  },
  {
    id: 'annual',
    name: 'Annual',
    price: '₹1,599',
    period: '/ year',
    monthly: '₹133.25',
    billing: 'Billed ₹1,599 once a year',
    note: 'Save ₹189 compared with twelve monthly payments.',
    featured: true,
    label: 'BEST LONG-TERM VALUE',
  },
];

const included = [
  {
    icon: '文',
    title: 'Grammar mistake intelligence',
    description: 'See why an answer missed the mark, recognise recurring patterns and focus on the grammar that needs attention.',
  },
  {
    icon: '↻',
    title: 'Adaptive revision',
    description: 'Bring due material and weaker topics back into your study routine, shaped around your learning progress.',
  },
  {
    icon: '語',
    title: 'Vocabulary intelligence',
    description: 'Build useful word knowledge in context, strengthen recall and identify vocabulary worth revisiting.',
  },
  {
    icon: '字',
    title: 'Kanji and kana practice',
    description: 'Build confidence with Japanese writing systems through structured reference and focused practice.',
  },
  {
    icon: '読',
    title: 'Reading and exam practice',
    description: 'Put your learning to work with reading activities, daily exercises and JLPT-style mock examinations.',
  },
];

const faqs = [
  {
    question: 'Do all plans include the same features?',
    answer: 'Yes. Every plan gives you the same NihongoLabs learning experience. The only difference is the length of the billing period.',
  },
  {
    question: 'How much is the 6-month plan per month?',
    answer: 'The 6-month plan is ₹809 upfront. Divided across six months, that is approximately ₹134.83 per month.',
  },
  {
    question: 'How much is the annual plan per month?',
    answer: 'The annual plan is ₹1,599 upfront. That works out to ₹133.25 per month across twelve months.',
  },
  {
    question: 'Are the 6-month and annual plans charged monthly?',
    answer: 'No. The displayed monthly equivalent is for comparison only. The full ₹809 or ₹1,599 is charged at the start of the selected plan.',
  },
  {
    question: 'Can I use NihongoLabs on my phone and computer?',
    answer: 'Yes. NihongoLabs is designed to work in modern desktop, tablet and mobile browsers.',
  },
  {
    question: 'Where can I manage my membership?',
    answer: 'After signing in, open Membership in your learning workspace to view your plan and available subscription actions.',
  },
];

export default async function PricingPage() {
  // This page personalizes its navigation from the incoming Supabase session.
  // Wait for the request before auth/session libraries read the current time.
  await connection();

  let signedIn = false;

  try {
    const supabase = await createServerSupabase();
    const { data } = await supabase.auth.getUser();
    signedIn = Boolean(data.user);
  } catch {
    // Keep the public pricing page available if auth cannot be checked.
  }

  const primaryHref = signedIn ? '/learn/plans' : '/signup';
  const primaryLabel = signedIn ? 'View learning plans' : 'Get started';

  return (
    <main className={styles.page}>
      <header className={styles.nav}>
        <Link href="/" className={styles.brand} aria-label="NihongoLabs home">
          <span className={styles.brandMark}>日</span>
          <span>Nihongo <b>Labs</b></span>
        </Link>
        <nav className={styles.navLinks} aria-label="Main navigation">
          <Link href="/#method">How it works</Link>
          <Link href="/pricing" aria-current="page">Plans</Link>
          {signedIn ? <Link href="/learn">My workspace</Link> : <Link href="/login">Sign in</Link>}
          <Link href={primaryHref} className={styles.navCta}>
            {signedIn ? 'Open membership' : 'Start learning'} <span>↗</span>
          </Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}><span /> A PLAN THAT FITS YOUR PACE <i>JLPT</i></div>
          <h1>Make room for<br /><em>real progress.</em></h1>
          <p>
            A thoughtful space to learn Japanese, practise with purpose and build a habit that lasts.
            Choose the billing rhythm that works for you.
          </p>
          <div className={styles.heroPoints}>
            <span><b>✓</b> One complete learning toolkit</span>
            <span><b>✓</b> The same features on every plan</span>
            <span><b>✓</b> Learn across your devices</span>
          </div>
          <a className={styles.heroTextLink} href="#plans">Explore the plans <span>↓</span></a>
        </div>

        <div className={styles.heroVisual} role="img" aria-label="Japanese study note with the character for learning">
          <div className={styles.visualHalo} />
          <div className={styles.paperBack}>
            <span className={styles.paperLabel}>YOUR LEARNING JOURNEY</span>
            <strong>学</strong>
            <span className={styles.paperCaption}>Learn · Practise · Remember</span>
          </div>
          <div className={styles.studyCard}>
            <div className={styles.studyCardTop}><span>NIHONGOLABS · STUDY NOTE</span><b>01</b></div>
            <div className={styles.studyGlyph}>学</div>
            <h2>One step at a time.</h2>
            <p>まいにち、すこしずつ。</p>
            <span className={styles.studyTranslation}>A little, every day.</span>
            <div className={styles.studyRule}>
              <b>THE IDEA</b>
              <span>Consistency makes progress feel natural.</span>
            </div>
          </div>
          <div className={styles.floatingNote}><b>毎日</b><span>MAKE IT A<br />DAILY HABIT</span></div>
          <div className={styles.floatingSeal}>日本語<br />を学ぼう</div>
        </div>
      </section>

      <section className={styles.pricingSection} id="plans" aria-labelledby="plans-title">
        <div className={styles.sectionHeading}>
          <div>
            <div className={styles.eyebrow}>SIMPLE, TRANSPARENT PRICING</div>
            <h2 id="plans-title">Choose your learning plan.</h2>
          </div>
          <p>Same learning experience. Three ways to pay. Pick the timeline that feels right for you.</p>
        </div>

        <div className={styles.planGrid}>
          {plans.map((plan) => (
            <article className={plan.featured ? styles.featuredPlan : styles.planCard} key={plan.id}>
              {plan.featured ? <div className={styles.recommended}>BEST VALUE</div> : null}
              <div className={styles.planKicker}>{plan.label}</div>
              <h3>{plan.name}</h3>
              <div className={styles.priceLine}>
                <strong>{plan.price}</strong>
                <span>{plan.period}</span>
              </div>
              <div className={styles.monthlyLine}>
                <span>Works out to</span>
                <b>{plan.monthly} / month</b>
              </div>
              <p className={styles.billing}>{plan.billing}</p>
              <p className={styles.saving}>{plan.note}</p>
              <div className={styles.planRule} />
              <div className={styles.sameAccess}><span>✓</span> Full NihongoLabs access</div>
              <Link href={primaryHref} className={plan.featured ? styles.primaryButton : styles.secondaryButton}>
                {primaryLabel}<span>→</span>
              </Link>
              <small className={styles.checkoutHint}>
                {signedIn ? 'Continue to membership and checkout.' : 'Sign in or create an account to continue.'}
              </small>
            </article>
          ))}
        </div>

        <p className={styles.billingNote}>
          Monthly equivalents are shown for comparison. The 6-month and annual plans are billed upfront for the full period.
        </p>
      </section>

      <section className={styles.includedSection} id="features" aria-labelledby="included-title">
        <div className={styles.includedIntro}>
          <div className={styles.eyebrow}>ONE COMPLETE LEARNING TOOLKIT</div>
          <h2 id="included-title">Everything works<br /><em>together.</em></h2>
          <p>
            No confusing feature tiers. Whichever plan you choose, you get the tools to understand,
            practise, remember and keep moving forward.
          </p>
        </div>
        <div className={styles.includedGrid}>
          {included.map((item) => (
            <article className={styles.includedCard} key={item.title}>
              <span className={styles.featureIcon} aria-hidden="true">{item.icon}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.ctaPanel}>
        <div className={styles.ctaDisc} />
        <div className={styles.ctaContent}>
          <div className={styles.eyebrow}>YOUR NEXT STEP STARTS HERE</div>
          <h2>Small steps.<br /><em>Fluent moments.</em></h2>
          <p>Make Japanese part of your everyday. Start with a plan that gives you room to grow.</p>
          <Link href={primaryHref} className={styles.ctaButton}>
            {signedIn ? 'View membership plans' : 'Start your learning journey'} <span>↗</span>
          </Link>
        </div>
        <div className={styles.ctaKanji} aria-hidden="true">日本語</div>
      </section>

      <section className={styles.faqSection} aria-labelledby="faq-title">
        <div className={styles.faqIntro}>
          <div className={styles.eyebrow}>GOOD TO KNOW</div>
          <h2 id="faq-title">A few things<br /><em>to clear up.</em></h2>
          <p>Clear answers before you choose your plan.</p>
        </div>
        <div className={styles.faqList}>
          {faqs.map((item) => (
            <details className={styles.faqItem} key={item.question}>
              <summary>{item.question}<span aria-hidden="true">+</span></summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <Link href="/" className={styles.brand} aria-label="NihongoLabs home">
            <span className={styles.brandMark}>日</span>
            <span>Nihongo <b>Labs</b></span>
          </Link>
          <p>Learn with intention. Grow every day.</p>
          <div className={styles.footerLinks}>
            <Link href="/login">Sign in</Link>
            <Link href="/learn">Workspace</Link>
            <Link href="/learn/subscription">Membership</Link>
          </div>
        </div>
        <small>© 2026 NihongoLabs</small>
      </footer>
    </main>
  );
}
