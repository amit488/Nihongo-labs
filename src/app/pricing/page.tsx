import Link from 'next/link';
import { createServerSupabase } from '@/lib/nihongo/server/supabase';

const plans = [
  { id: 'monthly', name: 'Monthly', price: 149, term: 'month', monthly: '₹149', billing: 'Billed ₹149 every month', note: 'Flexible monthly access', featured: false },
  { id: 'half-year', name: '6 Months', price: 809, term: '6 months', monthly: '₹134.83', billing: 'Billed ₹809 once every 6 months', note: 'Save ₹85 compared with six monthly payments', featured: false },
  { id: 'annual', name: 'Annual', price: 1599, term: 'year', monthly: '₹133.25', billing: 'Billed ₹1,599 once a year', note: 'Save ₹189 compared with twelve monthly payments', featured: true },
];

const included = [
  { icon: '文', title: 'Grammar mistake intelligence', description: 'Understand why an answer is wrong, spot recurring patterns and focus on the grammar that needs more practice.' },
  { icon: '先生', title: 'AI Japanese Sensei', description: 'Ask questions in context and get clear explanations, natural examples, and guidance suited to your JLPT level.' },
  { icon: '↻', title: 'Adaptive revision', description: 'Bring due material and weaker topics back into your practice so revision follows your learning progress.' },
  { icon: '語', title: 'Vocabulary intelligence', description: 'Learn words in context, strengthen recall and identify vocabulary that needs another review.' },
  { icon: '字', title: 'Kanji and kana practice', description: 'Build confidence with Japanese writing systems through structured reference and focused practice.' },
  { icon: '読', title: 'Reading and exam practice', description: 'Apply what you learn with reading activities, daily practice and JLPT-style mock examinations.' },
];

const faqs = [
  { q: 'What is the difference between the three plans?', a: 'All three plans provide the same plan access. The difference is how long you pay for at a time: monthly, every six months, or once a year.' },
  { q: 'How much does the 6-month plan cost per month?', a: 'The 6-month plan costs ₹809 upfront. That works out to approximately ₹134.83 per month over six months.' },
  { q: 'How much does the annual plan cost per month?', a: 'The annual plan costs ₹1,599 upfront. That works out to ₹133.25 per month over twelve months.' },
  { q: 'When will I be charged?', a: 'The monthly plan is billed monthly. The 6-month and annual plans are billed upfront for their full billing periods.' },
  { q: 'Can I use NihongoLabs on my phone and computer?', a: 'Yes. NihongoLabs is designed to work across desktop, tablet and mobile browsers.' },
  { q: 'Can I manage my membership after subscribing?', a: 'Yes. Sign in and open Membership in your learning workspace to view your subscription details and available management actions.' },
];

export default async function PricingPage() {
  let signedIn = false;
  try {
    const supabase = await createServerSupabase();
    const { data } = await supabase.auth.getUser();
    signedIn = Boolean(data.user);
  } catch {
    // Pricing remains available even if authentication is temporarily unavailable.
  }
  const primaryHref = signedIn ? '/learn/subscription' : '/signup';
  const primaryLabel = signedIn ? 'Choose a plan' : 'Get started';

  return (
    <main className="plansPage">
      <header className="plansNav">
        <Link className="plansBrand" href="/"><span>日</span><strong>Nihongo<span>Labs</span></strong></Link>
        <nav aria-label="Main navigation">
          <Link href="/#features">Features</Link>
          <Link href="/pricing" aria-current="page">Plans</Link>
          {signedIn ? <Link href="/learn">My workspace</Link> : <Link href="/login">Sign in</Link>}
          <Link className="plansNavCta" href={primaryHref}>{signedIn ? 'Open membership' : 'Start learning'} <span>↗</span></Link>
        </nav>
      </header>

      <section className="plansHero">
        <div className="plansEyebrow"><span /> SIMPLE, TRANSPARENT PRICING</div>
        <h1>Your Japanese journey.<br /><em>Your pace. Your plan.</em></h1>
        <p>One complete learning experience, with flexible ways to pay. Choose the billing period that works for you.</p>
        <div className="plansHighlights"><span>✓ Structured JLPT learning</span><span>✓ AI-powered learning support</span><span>✓ Practice that adapts</span></div>
      </section>

      <section className="plansSection" aria-labelledby="plans-heading">
        <div className="plansSectionHeading">
          <div><span className="plansEyebrow">PICK YOUR MEMBERSHIP</span><h2 id="plans-heading">Invest in your progress.</h2></div>
          <p>Every plan includes the same learning features. Choose your preferred billing period.</p>
        </div>
        <div className="plansGrid">
          {plans.map((plan) => (
            <article className={`planCard ${plan.featured ? 'planFeatured' : ''}`} key={plan.id}>
              {plan.featured ? <div className="planPopular">BEST VALUE</div> : null}
              <div className="planCardKicker">{plan.id === 'monthly' ? 'FLEXIBLE ACCESS' : plan.id === 'half-year' ? 'LONGER COMMITMENT' : 'LOWEST MONTHLY COST'}</div>
              <h3>{plan.name}</h3>
              <div className="planPrice">₹{plan.price.toLocaleString('en-IN')}<small> / {plan.term}</small></div>
              <div className="planMonthly">Equivalent to <strong>{plan.monthly}</strong> per month</div>
              <p className="planBilling">{plan.billing}</p>
              <p className="planSaving">{plan.note}</p>
              <div className="planDivider" />
              <div className="planIncludedTitle">Everything in NihongoLabs</div>
              <ul className="planFeatureList">
                <li>✓ Grammar and vocabulary practice</li>
                <li>✓ AI Japanese Sensei</li>
                <li>✓ Adaptive revision and learning insights</li>
                <li>✓ Kanji, kana and reading practice</li>
                <li>✓ JLPT-style mock examinations</li>
              </ul>
              <Link className={plan.featured ? 'planPrimary' : 'planSecondary'} href={primaryHref}>{primaryLabel}<span>→</span></Link>
              <small className="planCheckoutNote">{signedIn ? 'Continue to membership and checkout.' : 'Sign in or create an account to continue.'}</small>
            </article>
          ))}
        </div>
        <p className="plansBillingNote">Monthly equivalents are shown for comparison only. The 6-month and annual plans are charged upfront for the full period.</p>
      </section>

      <section className="includedSection" id="features">
        <div className="includedIntro"><span className="plansEyebrow">ONE COMPLETE LEARNING TOOLKIT</span><h2>Everything you need to move forward.</h2><p>No confusing feature tiers. Your chosen plan gives you access to the NihongoLabs learning experience for its billing period.</p></div>
        <div className="includedGrid">
          {included.map((item) => <article className="includedCard" key={item.title}><span className="includedIcon">{item.icon}</span><h3>{item.title}</h3><p>{item.description}</p></article>)}
        </div>
      </section>

      <section className="plansCta"><span className="plansEyebrow">YOUR NEXT STEP STARTS HERE</span><h2>Make Japanese part of your everyday.</h2><p>Small, consistent practice can take you a long way. Start building your routine with NihongoLabs.</p><Link href={primaryHref} className="planPrimary">{signedIn ? 'View membership plans' : 'Create your account'} <span>→</span></Link></section>

      <section className="faqSection">
        <div className="faqIntro"><span className="plansEyebrow">GOOD TO KNOW</span><h2>Frequently asked questions.</h2><p>Clear answers before you choose your plan.</p></div>
        <div className="faqList">{faqs.map((item) => <details className="faqItem" key={item.q}><summary>{item.q}<span>+</span></summary><p>{item.a}</p></details>)}</div>
      </section>

      <footer className="plansFooter"><Link className="plansBrand" href="/"><span>日</span><strong>Nihongo<span>Labs</span></strong></Link><p>Learn with clarity. Practice with purpose.</p><div><Link href="/login">Sign in</Link><Link href="/learn">Workspace</Link><Link href="/learn/subscription">Membership</Link></div><small>© 2026 NihongoLabs</small></footer>

      <style>{`
        .plansPage{--plans-ink:#232c37;--plans-muted:#74808b;--plans-accent:#b54c43;--plans-line:#e6e9ed;min-height:100vh;background:#f8f9fa;color:var(--plans-ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:0 30px 65px}
        .plansPage *{box-sizing:border-box}.plansNav{height:78px;max-width:1160px;margin:auto;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--plans-line)}
        .plansBrand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--plans-ink);font-size:18px}.plansBrand>span{width:36px;height:36px;border-radius:11px;background:var(--plans-ink);color:#f5c8a7;display:grid;place-items:center;font:22px Georgia,serif}.plansBrand strong{font-weight:800;letter-spacing:-.6px}.plansBrand strong span{color:var(--plans-accent)}
        .plansNav nav{display:flex;align-items:center;gap:27px}.plansNav nav a{font-size:14px;color:#65717c;text-decoration:none}.plansNav nav a[aria-current="page"]{color:var(--plans-accent);font-weight:750}.plansNav nav .plansNavCta{padding:11px 16px;border-radius:8px;background:var(--plans-accent);color:white;font-weight:750}
        .plansHero{max-width:850px;text-align:center;margin:82px auto 70px}.plansEyebrow{font-size:11px;letter-spacing:1.8px;font-weight:850;color:var(--plans-accent)}.plansEyebrow>span{display:inline-block;width:7px;height:7px;border-radius:50%;background:#c7695e;margin:0 8px 1px 0}
        .plansHero h1{font-size:clamp(43px,6vw,70px);line-height:1.03;letter-spacing:-3.6px;font-weight:700;margin:22px 0 20px}.plansHero h1 em{font-family:Georgia,serif;color:var(--plans-accent);font-weight:400}.plansHero>p{max-width:620px;margin:auto;color:var(--plans-muted);font-size:17px;line-height:1.8}
        .plansHighlights{display:flex;justify-content:center;gap:23px;flex-wrap:wrap;margin-top:28px;color:#5e6a74;font-size:12px;font-weight:650}.plansHighlights span{white-space:nowrap}
        .plansSection{max-width:1100px;margin:auto}.plansSectionHeading{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:25px}.plansSectionHeading h2,.includedIntro h2,.faqIntro h2{font-size:clamp(27px,3vw,37px);letter-spacing:-1.5px;margin:9px 0 0}.plansSectionHeading>p{max-width:340px;color:var(--plans-muted);font-size:13px;line-height:1.7;margin:0 0 3px}
        .plansGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;align-items:stretch}.planCard{position:relative;background:white;border:1px solid var(--plans-line);border-radius:15px;padding:27px 24px 23px;display:flex;flex-direction:column;box-shadow:0 9px 30px rgba(35,44,55,.035);min-width:0}.planFeatured{border:2px solid #c9796f;box-shadow:0 16px 42px rgba(181,76,67,.10)}.planPopular{position:absolute;right:18px;top:0;background:var(--plans-accent);color:white;font-size:9px;font-weight:850;letter-spacing:1px;padding:7px 10px;border-radius:0 0 6px 6px}.planCardKicker{font-size:9px;letter-spacing:1.45px;color:#9aa3ac;font-weight:850;margin-bottom:12px}.planCard h3{font-size:21px;letter-spacing:-.6px;margin:0 0 15px}.planPrice{font-size:38px;letter-spacing:-1.8px;font-weight:800;white-space:nowrap}.planPrice small{font-size:12px;letter-spacing:0;color:#7d8992;font-weight:550}.planMonthly{margin-top:5px;font-size:12px;color:#78848d}.planMonthly strong{color:var(--plans-ink);font-size:13px}.planBilling{margin:14px 0 5px;color:#53616b;font-size:12px;font-weight:700}.planSaving{min-height:34px;margin:0;color:#89939b;font-size:11px;line-height:1.5}.planDivider{height:1px;background:#edf0f2;margin:18px 0}.planIncludedTitle{font-size:11px;font-weight:800;margin-bottom:8px}.planFeatureList{list-style:none;padding:0;margin:0 0 22px;flex:1}.planFeatureList li{font-size:11px;line-height:1.5;color:#5f6b74;padding:6px 0}.planFeatureList li::first-letter{color:var(--plans-accent)}.planPrimary,.planSecondary{display:flex;align-items:center;justify-content:space-between;text-decoration:none;border-radius:8px;padding:13px 14px;font-size:12px;font-weight:800}.planPrimary{background:var(--plans-accent);color:white}.planSecondary{background:#f0f2f4;color:#35424d}.planCheckoutNote{display:block;text-align:center;color:#9aa3ac;font-size:10px;margin-top:10px}.plansBillingNote{font-size:11px;color:#89939b;text-align:center;margin:19px auto 0;line-height:1.6}
        .includedSection{max-width:1100px;margin:105px auto 0}.includedIntro{max-width:650px;margin-bottom:30px}.includedIntro h2{margin-top:10px}.includedIntro>p,.faqIntro>p{color:var(--plans-muted);font-size:14px;line-height:1.8}.includedGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.includedCard{background:#fff;border:1px solid var(--plans-line);border-radius:12px;padding:22px 20px}.includedIcon{width:35px;height:35px;display:grid;place-items:center;border-radius:10px;background:#f8eeec;color:var(--plans-accent);font-size:17px;font-weight:800}.includedCard h3{font-size:14px;margin:15px 0 7px}.includedCard p{font-size:12px;line-height:1.7;color:var(--plans-muted);margin:0}
        .plansCta{max-width:1100px;margin:95px auto 0;text-align:center;background:#232c37;color:#fff;border-radius:18px;padding:55px 25px}.plansCta h2{font-size:clamp(27px,4vw,40px);letter-spacing:-1.5px;margin:13px 0}.plansCta>p{max-width:500px;margin:0 auto 24px;color:#c0c8ce;font-size:13px;line-height:1.8}.plansCta .plansEyebrow{color:#e5a37a}.plansCta .planPrimary{display:inline-flex;gap:35px;min-width:190px;justify-content:space-between}
        .faqSection{max-width:1000px;margin:100px auto 0;display:grid;grid-template-columns:.8fr 1.2fr;gap:65px}.faqIntro h2{margin-top:11px}.faqList{border-top:1px solid var(--plans-line)}.faqItem{border-bottom:1px solid var(--plans-line);padding:17px 0}.faqItem summary{display:flex;justify-content:space-between;gap:15px;cursor:pointer;list-style:none;font-size:13px;font-weight:750}.faqItem summary::-webkit-details-marker{display:none}.faqItem summary span{font-size:18px;color:var(--plans-accent)}.faqItem p{font-size:12px;line-height:1.8;color:var(--plans-muted);margin:12px 25px 0 0}
        .plansFooter{max-width:1160px;margin:85px auto 0;border-top:1px solid var(--plans-line);padding-top:25px;display:flex;align-items:center;gap:22px;flex-wrap:wrap}.plansFooter>p{font-size:11px;color:var(--plans-muted);margin-right:auto}.plansFooter>div{display:flex;gap:18px}.plansFooter>div a{font-size:11px;color:#68747e;text-decoration:none}.plansFooter>small{width:100%;font-size:10px;color:#9aa3ac}
        @media(max-width:850px){.plansGrid{grid-template-columns:1fr;max-width:520px;margin:auto}.plansSectionHeading{display:block}.plansSectionHeading>p{margin-top:10px}.planCard{padding:26px}.includedGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.faqSection{grid-template-columns:1fr;gap:22px}.plansHero{margin:62px auto 55px}.plansHighlights{gap:12px 18px}}
        @media(max-width:560px){.plansPage{padding:0 17px 45px}.plansNav{height:68px}.plansNav nav{gap:12px}.plansNav nav a:not(.plansNavCta){display:none}.plansHero h1{letter-spacing:-2.3px}.plansHero>p{font-size:15px}.includedGrid{grid-template-columns:1fr}.includedSection,.faqSection{margin-top:70px}.plansCta{margin-top:70px;padding:40px 20px}.plansFooter{margin-top:60px;gap:13px}.plansFooter>p{width:100%;margin:0}.plansFooter>div{margin-left:auto}}
      `}</style>
    </main>
  );
}
