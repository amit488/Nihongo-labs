import Link from 'next/link';
import { createServerSupabase } from '@/lib/nihongo/server/supabase';
import { listPlans } from '@/lib/nihongo/server/services/billing';

export const dynamic = 'force-dynamic';

function amount(minor: number, currency: string) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(minor / 100);
}

export default async function PricingPage() {
  let plans: Awaited<ReturnType<typeof listPlans>> = [];
  let unavailable = false;
  try {
    plans = await listPlans(await createServerSupabase());
  } catch {
    unavailable = true;
  }

  return (
    <main className="pricingPage">
      <header className="pricingNav">
        <Link className="pricingBrand" href="/"><span>日</span> Nihongo <b>Labs</b></Link>
        <nav><Link href="/learn">Workspace</Link><Link href="/login">Sign in</Link><Link className="pricingNavCta" href="/signup">Start learning ↗</Link></nav>
      </header>
      <section className="pricingHero">
        <div className="pricingEyebrow">SIMPLE PLANS · STEADY PROGRESS</div>
        <h1>A little practice.<br/><em>A lot of progress.</em></h1>
        <p>Start free, build a daily habit, then unlock deeper revision and exam preparation when you're ready.</p>
      </section>
      {unavailable ? <div className="pricingAlert">Plan information is temporarily unavailable. Check your local Supabase connection and the subscription plan seed.</div> : null}
      <section className="pricingGrid" aria-label="Subscription plans">
        {plans.map((plan) => {
          const free = plan.planKind === 'free' || plan.amountMinor === 0;
          const featured = plan.code === 'plus_monthly';
          return (
            <article className={`pricingCard ${featured ? 'pricingFeatured' : ''}`} key={plan.id}>
              {featured ? <div className="pricingPopular">MOST POPULAR</div> : null}
              <div className="pricingCardLabel">{free ? 'START HERE' : plan.code === 'basic_monthly' ? 'FOR YOUR DAILY ROUTINE' : 'FOR CONSISTENT LEARNERS'}</div>
              <h2>{plan.name}</h2>
              <div className="pricingAmount">{amount(plan.amountMinor, plan.currency)}<small>{free ? ' / forever' : ` / ${plan.billingInterval}`}</small></div>
              <p>{plan.description}</p>
              <ul>{plan.features.map((feature) => <li key={feature.key}><span>✓</span>{feature.key.replaceAll('_', ' ')}</li>)}</ul>
              <Link className={featured ? 'pricingPrimary' : 'pricingSecondary'} href={free ? '/signup' : '/signup'}>{free ? 'Create free account' : 'Choose plan'} <span>↗</span></Link>
              {!free ? <small className="pricingFootnote">Secure checkout opens after sign-in.</small> : null}
            </article>
          );
        })}
        {!plans.length && !unavailable ? <div className="pricingAlert">No active plans are configured yet. Run the local starter plan seed to publish Free, Basic and Plus.</div> : null}
      </section>
      <div className="pricingBottom"><span>All plans are managed through your account.</span><Link href="/learn/subscription">Already a member? Manage your plan →</Link></div>
      <style>{`
        .pricingPage{min-height:100vh;background:#f7f8f7;color:#202b30;padding:0 28px 70px}.pricingNav{max-width:1120px;margin:auto;height:78px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e7e9e7}.pricingBrand{display:flex;align-items:center;gap:9px;text-decoration:none;color:#202b30;font-size:16px}.pricingBrand>span{display:grid;place-items:center;width:30px;height:30px;border-radius:8px;background:#b54c43;color:white}.pricingBrand b{font-weight:800}.pricingNav nav{display:flex;align-items:center;gap:25px}.pricingNav nav a{font-size:12px;text-decoration:none;color:#59676e}.pricingNav nav .pricingNavCta{background:#b54c43;color:white;padding:11px 15px;border-radius:7px}.pricingHero{max-width:800px;text-align:center;margin:78px auto 48px}.pricingEyebrow{font-size:9px;letter-spacing:1.7px;color:#b54c43;font-weight:800}.pricingHero h1{font-size:clamp(42px,6vw,66px);line-height:1.02;letter-spacing:-3px;margin:21px 0 17px;font-weight:650}.pricingHero h1 em{font-family:Georgia,serif;color:#b54c43;font-weight:400}.pricingHero p{font-size:14px;line-height:1.8;color:#748087;max-width:490px;margin:auto}.pricingGrid{max-width:1000px;margin:auto;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:17px;align-items:stretch}.pricingCard{background:white;border:1px solid #e6e9e7;border-radius:11px;padding:28px 25px 23px;position:relative;display:flex;flex-direction:column;box-shadow:0 10px 30px rgba(29,48,43,.035)}.pricingFeatured{border-color:#d9b4ad;box-shadow:0 18px 45px rgba(120,68,58,.09)}.pricingPopular{position:absolute;right:18px;top:0;background:#b54c43;color:white;font-size:8px;font-weight:800;letter-spacing:1px;padding:7px 10px;border-radius:0 0 5px 5px}.pricingCardLabel{font-size:8px;letter-spacing:1.3px;font-weight:800;color:#9aa3a6;margin-bottom:15px}.pricingCard h2{font-size:23px;letter-spacing:-.7px;margin:0 0 16px}.pricingAmount{font-size:35px;letter-spacing:-1.4px;font-weight:750}.pricingAmount small{font-size:10px;letter-spacing:0;color:#89949a;font-weight:500}.pricingCard>p{font-size:11px;line-height:1.7;color:#7b878e;min-height:57px}.pricingCard ul{padding:14px 0 20px;margin:0;list-style:none;border-top:1px solid #edf0ee;flex:1}.pricingCard li{font-size:10px;color:#56656b;display:flex;gap:9px;align-items:center;padding:7px 0;text-transform:capitalize}.pricingCard li span{color:#b54c43;font-weight:900}.pricingPrimary,.pricingSecondary{display:flex;justify-content:space-between;align-items:center;text-decoration:none;font-size:11px;font-weight:750;border-radius:6px;padding:13px 14px}.pricingPrimary{background:#b54c43;color:white}.pricingSecondary{background:#f4f6f4;color:#34434a}.pricingFootnote{text-align:center;color:#9aa3a6;font-size:9px;margin-top:10px}.pricingAlert{max-width:1000px;margin:0 auto 18px;background:#fff8ed;border:1px solid #f1dfc3;border-radius:7px;padding:13px 16px;color:#83643b;font-size:11px}.pricingBottom{max-width:1000px;margin:28px auto 0;display:flex;justify-content:space-between;color:#8a959a;font-size:10px}.pricingBottom a{color:#b54c43;text-decoration:none;font-weight:700}@media(max-width:780px){.pricingGrid{grid-template-columns:1fr;max-width:460px}.pricingHero{margin:60px auto 35px}.pricingCard>p{min-height:auto}.pricingBottom{max-width:460px;gap:15px;flex-wrap:wrap}.pricingNav{height:68px}.pricingNav nav{gap:14px}.pricingNav nav a:not(.pricingNavCta){display:none}}@media(max-width:420px){.pricingPage{padding:0 17px 45px}.pricingHero h1{letter-spacing:-2px}.pricingNav{padding:0 2px}}
      `}</style>
    </main>
  );
}
